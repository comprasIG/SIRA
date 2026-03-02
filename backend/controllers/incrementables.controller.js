// C:\SIRA\backend\controllers\incrementables.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Incrementables de Importación (Landed Cost)
 * =================================================================================================
 * Gestiona la creación de OC de costos adicionales (flete, impuestos, última milla, etc.)
 * que afectan a una o más OC de importación, distribuyendo el costo proporcionalmente
 * al valor de cada artículo en las OC base.
 *
 * Endpoints:
 *   GET  /api/incrementables/                      → listarIncrementables
 *   GET  /api/incrementables/datos-iniciales        → getDatosIniciales
 *   GET  /api/incrementables/:id/preview-distribucion → previewDistribucion
 *   POST /api/incrementables/crear                 → crearIncrementable
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');
const { uploadOcPdfBuffer } = require('../services/googleDrive');
const { sendEmailWithAttachments } = require('../services/emailService');

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers (reutilizados del patrón de oc-directa.controller.js)
 * ───────────────────────────────────────────────────────────────────────────*/

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round4 = (n) => Math.round((toNum(n) + Number.EPSILON) * 10000) / 10000;

const safeText = (v, fallback = 'N/D') => {
  const s = String(v ?? '').trim();
  return s.length ? s : fallback;
};

const formatOcForDisplay = (numeroOcRaw, padDigits = 4) => {
  const raw = String(numeroOcRaw ?? '').trim();
  const match = raw.match(/(\d+)/);
  if (!match) return raw || 'OC-S/N';
  const digits = match[1];
  const padded = digits.length >= padDigits ? digits : digits.padStart(padDigits, '0');
  return `OC-${padded}`;
};

const sanitizeFileName = (s) => {
  return String(s ?? '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s/g, ' - ')
    .trim();
};

const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
  const result = await client.query(
    `SELECT u.correo
     FROM usuarios u
     JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
     JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
     WHERE ng.codigo = $1 AND u.activo = true`,
    [codigoGrupo]
  );
  return result.rows.map(r => r.correo);
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Algoritmo de distribución proporcional
 * ───────────────────────────────────────────────────────────────────────────*/

/**
 * Calcula la distribución proporcional del costo incrementable entre artículos.
 *
 * @param {Array}  lineas          - Líneas de OC base: { oc_detalle_id, material_id, material_nombre,
 *                                   oc_base_id, cantidad, precio_unitario, moneda,
 *                                   proyecto_nombre, numero_oc }
 * @param {number} montoTotal      - Monto total del incrementable
 * @param {string} monedaIncr      - Moneda del incrementable
 * @param {Object} tiposCambio     - { "MXN": 1, "USD": 17.5, "EUR": 19.2, ... }
 * @returns {Array} distribucion   - Array con porcentaje_asignado y monto_incrementable por línea
 */
const calcularDistribucion = (lineas, montoTotal, monedaIncr, tiposCambio) => {
  const tcs = tiposCambio || {};

  // Calcular costo base en MXN equivalente para cada línea
  const lineasConPeso = lineas.map(l => {
    const costo_base = round4(toNum(l.cantidad) * toNum(l.precio_unitario));
    const tc = toNum(tcs[l.moneda] ?? tcs['MXN'] ?? 1) || 1;
    const costo_base_mxn_equiv = round4(costo_base * tc);
    return { ...l, costo_base, tipo_cambio_mxn: tc, costo_base_mxn_equiv };
  });

  const totalMxn = lineasConPeso.reduce((s, l) => s + l.costo_base_mxn_equiv, 0);

  if (totalMxn <= 0) {
    // Sin peso → distribución igualitaria
    const porcentaje = lineasConPeso.length > 0 ? round4(1 / lineasConPeso.length) : 0;
    return lineasConPeso.map((l, i) => ({
      ...l,
      porcentaje_asignado: porcentaje,
      monto_incrementable: round4(montoTotal * porcentaje),
      moneda_incrementable: monedaIncr,
    }));
  }

  let sumaMontosAsignados = 0;
  const resultado = lineasConPeso.map((l, i) => {
    const porcentaje = round4(l.costo_base_mxn_equiv / totalMxn);
    let monto = round4(montoTotal * porcentaje);

    if (i === lineasConPeso.length - 1) {
      // Último artículo absorbe diferencia de redondeo
      monto = round4(montoTotal - sumaMontosAsignados);
    } else {
      sumaMontosAsignados += monto;
    }

    return {
      ...l,
      porcentaje_asignado: porcentaje,
      monto_incrementable: monto,
      moneda_incrementable: monedaIncr,
    };
  });

  return resultado;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Consulta reutilizable: líneas de OC base
 * ───────────────────────────────────────────────────────────────────────────*/

const getLineasOcBase = async (ocBaseIds, client) => {
  const { rows } = await (client || pool).query(
    `SELECT
       ocd.id           AS oc_detalle_id,
       ocd.orden_compra_id AS oc_base_id,
       ocd.material_id,
       ocd.cantidad,
       ocd.precio_unitario,
       ocd.moneda,
       cm.nombre        AS material_nombre,
       cm.sku,
       oc.numero_oc,
       p.nombre         AS proyecto_nombre,
       s.nombre         AS sitio_nombre
     FROM ordenes_compra_detalle ocd
     JOIN ordenes_compra oc ON ocd.orden_compra_id = oc.id
     JOIN proyectos p ON oc.proyecto_id = p.id
     JOIN sitios s ON oc.sitio_id = s.id
     JOIN catalogo_materiales cm ON ocd.material_id = cm.id
     WHERE ocd.orden_compra_id = ANY($1)
       AND ocd.material_id IS NOT NULL
     ORDER BY ocd.orden_compra_id, ocd.id`,
    [ocBaseIds]
  );
  return rows;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/incrementables/datos-iniciales
 * ───────────────────────────────────────────────────────────────────────────*/

const getDatosIniciales = async (req, res) => {
  try {
    const [tipos, ocsImpo, proveedores, monedas] = await Promise.all([
      pool.query(`SELECT id, codigo, nombre FROM tipo_incrementables WHERE activo = true ORDER BY nombre`),
      pool.query(`
        SELECT
          oc.id,
          oc.numero_oc,
          oc.total,
          oc.sub_total,
          oc.sitio_id,
          oc.proyecto_id,
          oc.lugar_entrega,
          oc.status,
          (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id AND moneda IS NOT NULL LIMIT 1) AS moneda,
          p.nombre  AS proyecto_nombre,
          s.nombre  AS sitio_nombre,
          prov.razon_social AS proveedor_nombre,
          prov.marca AS proveedor_marca
        FROM ordenes_compra oc
        JOIN proyectos p   ON oc.proyecto_id = p.id
        JOIN sitios s      ON oc.sitio_id = s.id
        JOIN proveedores prov ON oc.proveedor_id = prov.id
        WHERE oc.impo = true
          AND oc.status NOT IN ('CANCELADA', 'RECHAZADA')
        ORDER BY oc.id DESC
      `),
      pool.query(`SELECT id, razon_social, marca, rfc FROM proveedores ORDER BY razon_social`),
      pool.query(`SELECT codigo, nombre FROM catalogo_monedas ORDER BY codigo`),
    ]);

    res.json({
      tipos: tipos.rows,
      ocs_impo: ocsImpo.rows,
      proveedores: proveedores.rows,
      monedas: monedas.rows,
    });
  } catch (error) {
    console.error('[INCREMENTABLES] Error en getDatosIniciales:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/incrementables/
 * ───────────────────────────────────────────────────────────────────────────*/

const listarIncrementables = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        io.id,
        io.comentario,
        io.creado_en,
        ti.id     AS tipo_id,
        ti.nombre AS tipo_nombre,
        ti.codigo AS tipo_codigo,
        oc.id          AS oc_id,
        oc.numero_oc,
        oc.status,
        oc.total,
        oc.sub_total,
        oc.es_urgente,
        (SELECT moneda FROM ordenes_compra_detalle
         WHERE orden_compra_id = oc.id AND moneda IS NOT NULL LIMIT 1) AS moneda,
        prov.razon_social AS proveedor_nombre,
        prov.marca        AS proveedor_marca,
        -- OC base afectadas
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'id', oc_b.id,
            'numero_oc', oc_b.numero_oc,
            'proyecto', p_b.nombre,
            'sitio', s_b.nombre,
            'total', oc_b.total
          ) ORDER BY oc_b.id)
           FROM incrementables_oc_aplicaciones ioa
           JOIN ordenes_compra oc_b ON ioa.oc_base_id = oc_b.id
           JOIN proyectos p_b ON oc_b.proyecto_id = p_b.id
           JOIN sitios s_b ON oc_b.sitio_id = s_b.id
           WHERE ioa.incrementable_id = io.id
          ), '[]'::json
        ) AS oc_bases
      FROM incrementables_oc io
      JOIN tipo_incrementables ti ON io.tipo_incrementable_id = ti.id
      JOIN ordenes_compra oc ON io.oc_incrementable_id = oc.id
      JOIN proveedores prov ON oc.proveedor_id = prov.id
      ORDER BY io.creado_en DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('[INCREMENTABLES] Error en listarIncrementables:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/incrementables/:id/preview-distribucion
 * ───────────────────────────────────────────────────────────────────────────*/

const previewDistribucion = async (req, res) => {
  try {
    const { oc_base_ids, tipo_cambios, monto_total, moneda_incrementable } = req.query;

    if (!oc_base_ids || !monto_total) {
      return res.status(400).json({ error: 'oc_base_ids y monto_total son requeridos.' });
    }

    const ids = (Array.isArray(oc_base_ids) ? oc_base_ids : oc_base_ids.split(',')).map(Number).filter(Boolean);
    const tcs = tipo_cambios ? JSON.parse(tipo_cambios) : { MXN: 1 };
    const monto = toNum(monto_total);
    const moneda = moneda_incrementable || 'MXN';

    const lineas = await getLineasOcBase(ids);

    if (lineas.length === 0) {
      return res.json([]);
    }

    const distribucion = calcularDistribucion(lineas, monto, moneda, tcs);

    res.json(distribucion);
  } catch (error) {
    console.error('[INCREMENTABLES] Error en previewDistribucion:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/incrementables/crear
 * ───────────────────────────────────────────────────────────────────────────*/

/**
 * Payload esperado:
 * {
 *   tipo_incrementable_id: number,
 *   proveedor_id: number,
 *   monto_total: number,
 *   moneda: string,            // 'MXN' | 'USD' | 'EUR' | ...
 *   oc_base_ids: number[],     // IDs de OC base IMPO
 *   tipo_cambios: {            // TC por moneda para convertir a MXN (para distribución)
 *     MXN: 1,
 *     USD: 17.5,
 *     EUR: 19.2,
 *     ...
 *   },
 *   comentario: string|null,
 *   es_urgente: boolean
 * }
 */
const crearIncrementable = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;
  const {
    tipo_incrementable_id,
    proveedor_id,
    monto_total,
    moneda,
    oc_base_ids,
    tipo_cambios,
    comentario,
    es_urgente: esUrgenteRaw,
  } = req.body;

  const esUrgente = Boolean(esUrgenteRaw);
  const montoTotal = toNum(monto_total);

  // Validaciones básicas
  if (!tipo_incrementable_id || !proveedor_id || !montoTotal || !moneda) {
    return res.status(400).json({ error: 'tipo_incrementable_id, proveedor_id, monto_total y moneda son requeridos.' });
  }
  if (!oc_base_ids || !Array.isArray(oc_base_ids) || oc_base_ids.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos una OC base.' });
  }

  const ocBaseIdsNum = oc_base_ids.map(Number).filter(Boolean);
  const tcs = tipo_cambios || { MXN: 1 };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 0) Datos del usuario ─────────────────────────────────────────────────
    const userRes = await client.query(
      `SELECT u.departamento_id, d.codigo AS depto_codigo
       FROM usuarios u
       JOIN departamentos d ON u.departamento_id = d.id
       WHERE u.id = $1 AND u.activo = true`,
      [usuarioId]
    );
    if (userRes.rowCount === 0) throw new Error('Usuario no autorizado o inactivo.');
    const { departamento_id, depto_codigo: deptoCodigo } = userRes.rows[0];

    // ── 1) Tipo de incrementable ─────────────────────────────────────────────
    const tipoRes = await client.query(
      `SELECT id, codigo, nombre FROM tipo_incrementables WHERE id = $1 AND activo = true`,
      [tipo_incrementable_id]
    );
    if (tipoRes.rowCount === 0) throw new Error('Tipo de incrementable no encontrado o inactivo.');
    const tipo = tipoRes.rows[0];

    // ── 2) OC base: validar que sean IMPO y tomar datos del primero ──────────
    const ocBasesRes = await client.query(
      `SELECT oc.id, oc.numero_oc, oc.sitio_id, oc.proyecto_id, oc.lugar_entrega,
              oc.impo, oc.status,
              p.nombre AS proyecto_nombre, s.nombre AS sitio_nombre,
              prov.razon_social AS proveedor_nombre
       FROM ordenes_compra oc
       JOIN proyectos p ON oc.proyecto_id = p.id
       JOIN sitios s ON oc.sitio_id = s.id
       JOIN proveedores prov ON oc.proveedor_id = prov.id
       WHERE oc.id = ANY($1)`,
      [ocBaseIdsNum]
    );

    if (ocBasesRes.rowCount === 0) throw new Error('No se encontraron las OC base seleccionadas.');

    for (const ocBase of ocBasesRes.rows) {
      if (!ocBase.impo) {
        throw new Error(`La OC ${ocBase.numero_oc} no está marcada como IMPO. Solo se pueden aplicar incrementables a OC de importación.`);
      }
    }

    const primeraOcBase = ocBasesRes.rows[0];

    // ── 3) Proveedor del incrementable ───────────────────────────────────────
    const provRes = await client.query(
      `SELECT id, razon_social, marca, rfc, correo FROM proveedores WHERE id = $1`,
      [proveedor_id]
    );
    if (provRes.rowCount === 0) throw new Error('Proveedor no encontrado.');
    const proveedor = provRes.rows[0];
    const proveedorNombre = proveedor.razon_social || proveedor.marca || 'PROVEEDOR';

    // ── 4) Crear requisición soporte ─────────────────────────────────────────
    const reqInsert = await client.query(
      `INSERT INTO requisiciones
         (usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida,
          lugar_entrega, comentario, status)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, 'ABIERTA')
       RETURNING id, numero_requisicion`,
      [
        usuarioId, departamento_id,
        primeraOcBase.proyecto_id, primeraOcBase.sitio_id,
        primeraOcBase.lugar_entrega,
        comentario || `Incrementable: ${tipo.nombre}`,
      ]
    );
    const { id: requisicionId, numero_requisicion } = reqInsert.rows[0];

    // Simular aprobación VB_REQ
    const seqConsec = await client.query(`SELECT nextval('rfq_consecutivo_seq') AS c`);
    const rfqCode = `${String(seqConsec.rows[0].c).padStart(4, '0')}_R.${numero_requisicion.split('_')[1] || ''}_${deptoCodigo}`;
    await client.query(
      `UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA', rfq_code = $1 WHERE id = $2`,
      [rfqCode, requisicionId]
    );

    // ── 5) Crear ordenes_compra (la OC del incrementable) ────────────────────
    const seqOc = await client.query(`SELECT nextval('ordenes_compra_id_seq') AS id`);
    const nuevaOcId = seqOc.rows[0].id;
    const numeroOcDb = `OC-${nuevaOcId}`;
    const numeroOcDisplay = formatOcForDisplay(numeroOcDb);

    await client.query(
      `INSERT INTO ordenes_compra
         (id, numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega,
          sub_total, iva, ret_isr, total, iva_rate, isr_rate,
          impo, status, proveedor_id, es_urgente)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, 0, 0, $8, 0, 0,
               false, 'POR_AUTORIZAR', $9, $10)`,
      [
        nuevaOcId, numeroOcDb, usuarioId, requisicionId,
        primeraOcBase.sitio_id, primeraOcBase.proyecto_id, primeraOcBase.lugar_entrega,
        montoTotal, proveedor_id, esUrgente,
      ]
    );

    // ── 6) Insertar línea en ordenes_compra_detalle (material_id = NULL) ─────
    const ocBaseNums = ocBasesRes.rows.map(b => b.numero_oc).join(', ');
    await client.query(
      `INSERT INTO ordenes_compra_detalle
         (orden_compra_id, material_id, cantidad, precio_unitario, moneda)
       VALUES ($1, NULL, 1, $2, $3)`,
      [nuevaOcId, montoTotal, moneda]
    );

    // ── 7) Crear registro incrementables_oc ──────────────────────────────────
    const incInsert = await client.query(
      `INSERT INTO incrementables_oc (tipo_incrementable_id, oc_incrementable_id, comentario)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tipo_incrementable_id, nuevaOcId, comentario || null]
    );
    const incrementableId = incInsert.rows[0].id;

    // ── 8) Crear incrementables_oc_aplicaciones (1 por OC base) ─────────────
    for (const ocBaseId of ocBaseIdsNum) {
      await client.query(
        `INSERT INTO incrementables_oc_aplicaciones (incrementable_id, oc_base_id)
         VALUES ($1, $2)`,
        [incrementableId, ocBaseId]
      );
    }

    // Obtener los aplicacion_ids recién insertados (para la distribución)
    const aplicacionesRes = await client.query(
      `SELECT id, oc_base_id FROM incrementables_oc_aplicaciones WHERE incrementable_id = $1`,
      [incrementableId]
    );
    const aplicacionPorOcBase = {};
    for (const a of aplicacionesRes.rows) {
      aplicacionPorOcBase[a.oc_base_id] = a.id;
    }

    // ── 9) Calcular y guardar distribución por artículo ──────────────────────
    const lineas = await getLineasOcBase(ocBaseIdsNum, client);

    if (lineas.length > 0) {
      const distribucion = calcularDistribucion(lineas, montoTotal, moneda, tcs);

      for (const item of distribucion) {
        const aplicacionId = aplicacionPorOcBase[item.oc_base_id];

        await client.query(
          `INSERT INTO incrementables_distribucion_items
             (incrementable_id, aplicacion_id, oc_base_id, oc_detalle_id, material_id,
              costo_base, moneda_base, tipo_cambio_mxn, costo_base_mxn_equiv,
              porcentaje_asignado, monto_incrementable, moneda_incrementable)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            incrementableId, aplicacionId, item.oc_base_id, item.oc_detalle_id, item.material_id,
            item.costo_base, item.moneda, item.tipo_cambio_mxn, item.costo_base_mxn_equiv,
            item.porcentaje_asignado, item.monto_incrementable, item.moneda_incrementable,
          ]
        );
      }

      // Actualizar monto_asignado por OC base en aplicaciones
      for (const ocBaseId of ocBaseIdsNum) {
        const montoOcBase = distribucion
          .filter(d => d.oc_base_id === Number(ocBaseId))
          .reduce((s, d) => s + d.monto_incrementable, 0);

        await client.query(
          `UPDATE incrementables_oc_aplicaciones
           SET monto_asignado = $1, moneda = $2
           WHERE incrementable_id = $3 AND oc_base_id = $4`,
          [round4(montoOcBase), moneda, incrementableId, ocBaseId]
        );
      }
    }

    // ── 10) Generar PDF ──────────────────────────────────────────────────────
    const ocDataRes = await client.query(
      `SELECT
         oc.*,
         prov.razon_social AS proveedor_razon_social,
         prov.marca        AS proveedor_marca,
         prov.rfc          AS proveedor_rfc,
         proj.nombre       AS proyecto_nombre,
         s.nombre          AS sitio_nombre,
         s_ent.nombre      AS lugar_entrega_nombre,
         u.nombre          AS usuario_nombre,
         u.correo          AS usuario_correo,
         $1::text          AS rfq_code,
         NOW()             AS fecha_aprobacion
       FROM ordenes_compra oc
       JOIN proveedores prov ON oc.proveedor_id = prov.id
       JOIN proyectos proj   ON oc.proyecto_id = proj.id
       JOIN sitios s         ON oc.sitio_id = s.id
       LEFT JOIN sitios s_ent ON s_ent.id = oc.lugar_entrega::int
       JOIN usuarios u       ON oc.usuario_id = u.id
       WHERE oc.id = $2`,
      [rfqCode, nuevaOcId]
    );
    const ocDataParaPdf = ocDataRes.rows[0];

    // Items del PDF: una línea por OC base con su monto proporcional
    const pdfItems = ocBasesRes.rows.map(base => {
      const montoBase = distribucion
        ? round4((distribucion || [])
            .filter(d => d.oc_base_id === base.id)
            .reduce((s, d) => s + d.monto_incrementable, 0))
        : round4(montoTotal / ocBasesRes.rows.length);

      return {
        sku: tipo.codigo,
        material_nombre: `${tipo.nombre} — ${base.numero_oc} (${base.proyecto_nombre} / ${base.sitio_nombre})`,
        unidad_simbolo: moneda,
        cantidad: 1,
        precio_unitario: montoBase,
        moneda: moneda,
      };
    });

    // Alias para que generatePurchaseOrderPdf use `lineas` correctamente
    const pdfItemsFormatted = pdfItems.map(i => ({
      ...i,
      // Campos esperados por el servicio PDF
      material_id: null,
      plazo_entrega: null,
    }));

    const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, pdfItemsFormatted, client);

    // Nombre y subject del archivo
    const sitioNombre = safeText(ocDataParaPdf.sitio_nombre, '');
    const subject = esUrgente
      ? `${numeroOcDisplay} - URGENTE - INCR - ${tipo.nombre} - ${proveedorNombre}`
      : `${numeroOcDisplay} - INCR - ${tipo.nombre} - ${proveedorNombre}`;
    const pdfFileName = `${sanitizeFileName(subject)}.pdf`;

    // Upload a Drive
    const driveFile = await uploadOcPdfBuffer(
      pdfBuffer,
      pdfFileName,
      deptoCodigo,
      numero_requisicion,
      numeroOcDb
    );

    if (!driveFile || !driveFile.webViewLink) {
      throw new Error('Falló la subida del PDF a Google Drive.');
    }

    // Email
    const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
    if (recipients.length > 0) {
      const urgentHtml = esUrgente ? `<p style="color:#C62828;font-weight:bold;">URGENTE</p>` : '';
      const ocBasesHtml = ocBasesRes.rows.map(b =>
        `<li>${b.numero_oc} — ${b.proyecto_nombre} / ${b.sitio_nombre} — ${b.proveedor_nombre}</li>`
      ).join('');

      const htmlBody = `
        ${urgentHtml}
        <p>Se generó una OC Incrementable de Importación pendiente de autorización.</p>
        <p>
          <b>OC:</b> ${numeroOcDisplay}<br/>
          <b>Tipo:</b> ${tipo.nombre}<br/>
          <b>Proveedor:</b> ${proveedorNombre}<br/>
          <b>Monto:</b> ${montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}<br/>
        </p>
        <p><b>OC de Importación afectadas:</b></p>
        <ul>${ocBasesHtml}</ul>
        ${comentario ? `<p><b>Comentario:</b> ${comentario}</p>` : ''}
        <p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>
        <p>Se adjunta la OC.</p>
      `;

      await sendEmailWithAttachments(
        recipients,
        subject,
        htmlBody,
        [{ filename: pdfFileName, content: pdfBuffer }]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: `OC Incrementable creada: ${numeroOcDb}`,
      numero_oc: numeroOcDb,
      id: nuevaOcId,
      incrementable_id: incrementableId,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[INCREMENTABLES] Error en crearIncrementable:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/* =================================================================================================
 * CATÁLOGOS: Tipos de Gasto Incrementable
 * ================================================================================================*/

const listarTipos = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tipo_incrementables ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[INCREMENTABLES] Error en listarTipos:', err);
    res.status(500).json({ error: 'Error al obtener tipos de gasto.' });
  }
};

const crearTipo = async (req, res) => {
  const { codigo, nombre } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre son requeridos.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tipo_incrementables (codigo, nombre) VALUES ($1, $2) RETURNING *',
      [codigo.toUpperCase().trim(), nombre.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un tipo con ese código.' });
    console.error('[INCREMENTABLES] Error en crearTipo:', err);
    res.status(500).json({ error: 'Error al crear el tipo de gasto.' });
  }
};

const actualizarTipo = async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, activo } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre son requeridos.' });
  try {
    const { rows } = await pool.query(
      'UPDATE tipo_incrementables SET codigo=$1, nombre=$2, activo=$3 WHERE id=$4 RETURNING *',
      [codigo.toUpperCase().trim(), nombre.trim(), activo !== false, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tipo no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un tipo con ese código.' });
    console.error('[INCREMENTABLES] Error en actualizarTipo:', err);
    res.status(500).json({ error: 'Error al actualizar el tipo de gasto.' });
  }
};

/* =================================================================================================
 * CATÁLOGOS: Incoterms
 * ================================================================================================*/

const listarIncoterms = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM catalogo_incoterms ORDER BY abreviatura ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[INCREMENTABLES] Error en listarIncoterms:', err);
    res.status(500).json({ error: 'Error al obtener incoterms.' });
  }
};

const crearIncoterm = async (req, res) => {
  const { incoterm, abreviatura } = req.body;
  if (!incoterm || !abreviatura) return res.status(400).json({ error: 'incoterm y abreviatura son requeridos.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO catalogo_incoterms (incoterm, abreviatura) VALUES ($1, $2) RETURNING *',
      [incoterm.trim(), abreviatura.toUpperCase().trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un incoterm con esa abreviatura.' });
    console.error('[INCREMENTABLES] Error en crearIncoterm:', err);
    res.status(500).json({ error: 'Error al crear el incoterm.' });
  }
};

const actualizarIncoterm = async (req, res) => {
  const { id } = req.params;
  const { incoterm, abreviatura, activo } = req.body;
  if (!incoterm || !abreviatura) return res.status(400).json({ error: 'incoterm y abreviatura son requeridos.' });
  try {
    const { rows } = await pool.query(
      'UPDATE catalogo_incoterms SET incoterm=$1, abreviatura=$2, activo=$3 WHERE id=$4 RETURNING *',
      [incoterm.trim(), abreviatura.toUpperCase().trim(), activo !== false, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Incoterm no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un incoterm con esa abreviatura.' });
    console.error('[INCREMENTABLES] Error en actualizarIncoterm:', err);
    res.status(500).json({ error: 'Error al actualizar el incoterm.' });
  }
};

module.exports = {
  getDatosIniciales,
  listarIncrementables,
  previewDistribucion,
  crearIncrementable,
  // Catálogos
  listarTipos,
  crearTipo,
  actualizarTipo,
  listarIncoterms,
  crearIncoterm,
  actualizarIncoterm,
};
