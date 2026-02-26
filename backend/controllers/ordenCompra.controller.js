// C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Descarga de PDF)
 * =================================================================================================
 * Objetivo:
 * - Descargar el PDF de una OC existente, sin alterar la lógica de guardado en BD.
 *
 * Reglas clave:
 * - numero_oc se guarda en BD como "OC-19" (NO se modifica).
 * - Presentación (PDF / nombre de archivo): padding 4 => "OC-0019", y no duplicar "OC OC-19".
 * - Nombre de archivo requerido (sin underscores):
 *     "OC-0019 - [URGENTE - ]{SITIO} - {PROYECTO} - {PROVEEDOR}.pdf"
 * - Una OC NO puede tener múltiples monedas en su detalle (validación).
 * - El correo del usuario (usuarios.correo) solo se muestra en el PDF.
 *
 * Cambios en esta versión:
 * - lugar_entrega es ID de sitios => se resuelve a nombre (sitios.nombre) como lugar_entrega_nombre
 * - filename con espacios y guiones (sin "_") y sanitizado solo para caracteres inválidos en Windows
 * - URGENTE va después del consecutivo: "OC-0019 - URGENTE - ..."
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');
const { uploadOcPdfBuffer } = require('../services/googleDrive');
const { sendEmailWithAttachments } = require('../services/emailService');

/* ================================================================================================
 * Helpers
 * ==============================================================================================*/

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n) => Math.round((toNum(n) + Number.EPSILON) * 10000) / 10000;

const safeText = (v, fallback = 'N/D') => {
  const s = String(v ?? '').trim();
  return s.length ? s : fallback;
};

/**
 * Presentación uniforme: "OC-19" -> "OC-0019" / "19" -> "OC-0019" / "OC-12345" -> "OC-12345"
 */
const formatOcForDisplay = (numeroOcRaw, padDigits = 4) => {
  const raw = String(numeroOcRaw ?? '').trim();
  const match = raw.match(/(\d+)/);
  if (!match) return raw || 'OC-S/N';

  const digits = match[1];
  const padded = digits.length >= padDigits ? digits : digits.padStart(padDigits, '0');
  return `OC-${padded}`;
};

/**
 * Sanitizado mínimo:
 * - Mantiene espacios y " - " tal cual
 * - Solo reemplaza caracteres inválidos en Windows: / \ : * ? " < > |
 */
const sanitizeFileName = (s) => {
  return String(s ?? '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s/g, ' - ')
    .trim();
};

const getProveedorNombre = (oc) => {
  const razon = String(oc?.proveedor_razon_social ?? '').trim();
  if (razon) return razon;
  const marca = String(oc?.proveedor_marca ?? '').trim();
  return marca || 'PROVEEDOR';
};

/* ================================================================================================
 * Endpoint: Descargar PDF
 * ==============================================================================================*/

const descargarOcPdf = async (req, res) => {
  const { id: ocId } = req.params;

  const idNum = Number(ocId);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro ocId inválido.' });
  }

  try {
    // 1) Traer cabecera OC + joins requeridos para PDF (incluye correo usuario y rfq_code)
    //    + lugar_entrega_nombre (sitios) a partir de oc.lugar_entrega (id)
    const ocDataQuery = await pool.query(
      `
SELECT
  oc.*,
  p.razon_social AS proveedor_razon_social,
  p.marca        AS proveedor_marca,
  p.rfc          AS proveedor_rfc,
  proy.nombre    AS proyecto_nombre,
  s.nombre       AS sitio_nombre,
  s_entrega.nombre AS lugar_entrega_nombre,
  u.nombre       AS usuario_nombre,
  u.correo       AS usuario_correo,
  r.rfq_code     AS rfq_code,
  (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
  COALESCE(oc.fecha_creacion, NOW()) AS fecha_aprobacion
FROM ordenes_compra oc
JOIN proveedores p ON oc.proveedor_id = p.id
JOIN proyectos proy ON oc.proyecto_id = proy.id
JOIN sitios s ON oc.sitio_id = s.id
LEFT JOIN sitios s_entrega ON s_entrega.id = oc.lugar_entrega::int
JOIN usuarios u ON oc.usuario_id = u.id
LEFT JOIN requisiciones r ON oc.rfq_id = r.id
WHERE oc.id = $1;
      `,
      [idNum]
    );

    if (ocDataQuery.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }

    const ocData = ocDataQuery.rows[0];

    // 2) Validación: una OC no puede tener múltiples monedas
    const monedaDistinct = await pool.query(
      `SELECT COUNT(DISTINCT moneda)::int AS cnt
       FROM ordenes_compra_detalle
       WHERE orden_compra_id = $1`,
      [idNum]
    );

    if ((monedaDistinct.rows[0]?.cnt ?? 1) > 1) {
      return res.status(409).json({
        error: `La OC ${safeText(ocData.numero_oc)} tiene múltiples monedas en el detalle. Esto no está permitido.`
      });
    }

    // 3) Items para PDF
    const itemsDataQuery = await pool.query(
      `
      SELECT
        ocd.*,
        cm.nombre AS material_nombre,
        cm.sku    AS sku,
        cu.simbolo AS unidad_simbolo
      FROM ordenes_compra_detalle ocd
      JOIN catalogo_materiales cm ON ocd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ocd.orden_compra_id = $1
      ORDER BY ocd.id ASC;
      `,
      [idNum]
    );

    const itemsData = itemsDataQuery.rows;

    // 4) Generar PDF (servicio maneja fondo, urgente, notas, etc.)
    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData, pool);

    // 5) Nombre de archivo requerido (sin "_", con guiones y espacios)
    const ocDisplay = formatOcForDisplay(ocData.numero_oc);
    const sitio = safeText(ocData.sitio_nombre, '');
    const proyecto = safeText(ocData.proyecto_nombre, '');
    const proveedor = getProveedorNombre(ocData);

    // URGENTE después del consecutivo
    const base = `${ocDisplay} - ${sitio} - ${proyecto} - ${proveedor}`;
    const name = ocData.es_urgente === true ? `${ocDisplay} - URGENTE - ${sitio} - ${proyecto} - ${proveedor}` : base;

    const fileName = `${sanitizeFileName(name)}.pdf`;

    // 6) Respuesta
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('[ordenCompra.controller] Error al generar/servir PDF:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};

/* ================================================================================================
 * Endpoint: Listar OCs (G_OC)
 * ==============================================================================================*/
const getOcs = async (req, res) => {
  try {
    const {
      status,
      proyecto,
      sitio,
      proveedor,
      search,
      fecha_inicio,
      fecha_fin,
      exclude_status,
      sort_by
    } = req.query;

    let query = `
            SELECT 
                oc.id,
                oc.numero_oc,
                oc.fecha_creacion,
                oc.total,
                (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
                oc.status,
                oc.proyecto_id,
                oc.sitio_id,
                oc.proveedor_id,
                p.nombre AS proyecto,
                s.nombre AS sitio,
                prov.razon_social AS proveedor,
                prov.razon_social AS proveedor_razon_social,
                prov.marca AS proveedor_marca,
                d.nombre AS departamento_requisicion,
                u.nombre AS usuario_creador
            FROM ordenes_compra oc
            LEFT JOIN proyectos p ON oc.proyecto_id = p.id
            LEFT JOIN sitios s ON oc.sitio_id = s.id
            LEFT JOIN proveedores prov ON oc.proveedor_id = prov.id
            LEFT JOIN usuarios u ON oc.usuario_id = u.id
            LEFT JOIN requisiciones r ON oc.rfq_id = r.id
            LEFT JOIN departamentos d ON r.departamento_id = d.id
            WHERE 1=1
        `;

    const params = [];
    let paramIndex = 1;
    const addParam = (value) => {
      params.push(value);
      return `$${paramIndex++}`;
    };

    if (status && status !== 'TODAS') {
      if (status === 'ABIERTAS') {
        query += ` AND oc.status::text NOT IN ('ENTREGADA', 'RECHAZADA', 'CANCELADA')`;
      } else {
        query += ` AND oc.status = ${addParam(status)}`;
      }
    }

    if (exclude_status) {
      const excluded = exclude_status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (excluded.length > 0) {
        query += ` AND oc.status::text <> ALL(${addParam(excluded)}::text[])`;
      }
    }

    if (proyecto) {
      const proyectoValue = String(proyecto).trim();
      if (/^\d+$/.test(proyectoValue)) {
        query += ` AND oc.proyecto_id = ${addParam(Number(proyectoValue))}`;
      } else {
        query += ` AND p.nombre ILIKE ${addParam(`%${proyectoValue}%`)}`;
      }
    }

    if (sitio) {
      const sitioValue = String(sitio).trim();
      if (/^\d+$/.test(sitioValue)) {
        query += ` AND oc.sitio_id = ${addParam(Number(sitioValue))}`;
      } else {
        query += ` AND s.nombre ILIKE ${addParam(`%${sitioValue}%`)}`;
      }
    }

    if (proveedor) {
      const proveedorValue = String(proveedor).trim();
      if (/^\d+$/.test(proveedorValue)) {
        query += ` AND oc.proveedor_id = ${addParam(Number(proveedorValue))}`;
      } else {
        const searchProvider = addParam(`%${proveedorValue}%`);
        query += ` AND (prov.razon_social ILIKE ${searchProvider} OR prov.marca ILIKE ${searchProvider})`;
      }
    }

    if (search) {
      const searchParam = addParam(`%${String(search).trim()}%`);
      query += ` AND (
                oc.numero_oc ILIKE ${searchParam} OR
                CAST(oc.id AS TEXT) ILIKE ${searchParam} OR
                prov.razon_social ILIKE ${searchParam} OR
                prov.marca ILIKE ${searchParam} OR
                p.nombre ILIKE ${searchParam} OR
                s.nombre ILIKE ${searchParam} OR
                d.nombre ILIKE ${searchParam}
             )`;
    }

    if (fecha_inicio) {
      query += ` AND oc.fecha_creacion >= ${addParam(fecha_inicio)}::date`;
    }

    if (fecha_fin) {
      query += ` AND oc.fecha_creacion < (${addParam(fecha_fin)}::date + INTERVAL '1 day')`;
    }

    const sortMap = {
      numero_oc_desc: 'oc.numero_oc DESC NULLS LAST, oc.id DESC',
      numero_oc_asc: 'oc.numero_oc ASC NULLS LAST, oc.id ASC',
      fecha_desc: 'oc.fecha_creacion DESC, oc.id DESC',
      fecha_asc: 'oc.fecha_creacion ASC, oc.id ASC'
    };
    query += ` ORDER BY ${sortMap[sort_by] || sortMap.fecha_desc}`;

    const result = await pool.query(query, params);

    const kpisRaw = result.rows.reduce(
      (acc, oc) => {
        const currentStatus = oc?.status;
        acc.total += 1;
        if (currentStatus === 'ENTREGADA') acc.entregadas += 1;
        if (currentStatus === 'POR_AUTORIZAR') acc.por_autorizar += 1;
        if (currentStatus === 'RECHAZADA' || currentStatus === 'CANCELADA') acc.rechazadas += 1;
        if (!['ENTREGADA', 'RECHAZADA', 'CANCELADA'].includes(currentStatus)) acc.abiertas += 1;
        return acc;
      },
      { total: 0, entregadas: 0, rechazadas: 0, por_autorizar: 0, abiertas: 0 }
    );

    const kpis = {
      total: parseInt(kpisRaw.total || 0),
      entregadas: parseInt(kpisRaw.entregadas || 0),
      rechazadas: parseInt(kpisRaw.rechazadas || 0),
      porAutorizar: parseInt(kpisRaw.por_autorizar || 0),
      abiertas: parseInt(kpisRaw.abiertas || 0)
    };

    res.json({
      ocs: result.rows,
      kpis: kpis
    });

  } catch (error) {
    console.error('Error getting OCs:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra.' });
  }
};


const getOcFilters = async (req, res) => {
  try {
    const { status, exclude_status } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'TODAS') {
      whereClause += ` AND oc.status = $${paramIndex++}`;
      params.push(status);
    }

    if (exclude_status) {
      const excluded = exclude_status.split(',').map(s => s.trim());
      if (excluded.length > 0) {
        whereClause += ` AND oc.status NOT IN (${excluded.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        params.push(...excluded);
        paramIndex += excluded.length;
      }
    }

    const proyectosQuery = `
      SELECT DISTINCT p.id, p.nombre
      FROM ordenes_compra oc
      JOIN proyectos p ON oc.proyecto_id = p.id
      ${whereClause}
      ORDER BY p.nombre
    `;

    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre, oc.proyecto_id
      FROM ordenes_compra oc
      JOIN sitios s ON oc.sitio_id = s.id
      ${whereClause}
      ORDER BY s.nombre
    `;

    const [proyectosRes, sitiosRes] = await Promise.all([
      pool.query(proyectosQuery, params),
      pool.query(sitiosQuery, params)
    ]);

    res.json({
      proyectos: proyectosRes.rows,
      sitios: sitiosRes.rows
    });

  } catch (error) {
    console.error('Error getting OC filters:', error);
    res.status(500).json({ error: 'Error al obtener filtros.' });
  }
};

/* ================================================================================================
 * Helper: destinatarios de email por grupo
 * ==============================================================================================*/
const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
  const result = await client.query(
    `SELECT u.correo FROM usuarios u
     JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
     JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
     WHERE ng.codigo = $1 AND u.activo = true`,
    [codigoGrupo]
  );
  return result.rows.map(r => r.correo);
};

/* ================================================================================================
 * Endpoint: Datos para editar una OC (GET /api/ocs/:id/editar-datos)
 * ==============================================================================================*/
const getDatosParaEditar = async (req, res) => {
  const idNum = Number(req.params.id);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro id inválido.' });
  }

  try {
    const ocQuery = await pool.query(
      `SELECT oc.id, oc.numero_oc, oc.proveedor_id, oc.comentarios_finanzas,
              oc.iva_rate, oc.isr_rate, oc.impo, oc.status, oc.es_urgente,
              oc.sub_total, oc.iva, oc.ret_isr, oc.total,
              oc.rfq_id, oc.proyecto_id, oc.sitio_id,
              p.razon_social AS proveedor_nombre, p.marca AS proveedor_marca,
              proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       JOIN proyectos proy ON oc.proyecto_id = proy.id
       JOIN sitios s ON oc.sitio_id = s.id
       WHERE oc.id = $1`,
      [idNum]
    );
    if (ocQuery.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }

    const itemsQuery = await pool.query(
      `SELECT ocd.id, ocd.material_id, ocd.requisicion_detalle_id,
              cm.nombre AS material_nombre, cm.sku AS material_sku,
              cu.simbolo AS unidad_simbolo,
              ocd.cantidad, ocd.precio_unitario, ocd.moneda, ocd.plazo_entrega
       FROM ordenes_compra_detalle ocd
       JOIN catalogo_materiales cm ON ocd.material_id = cm.id
       JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
       WHERE ocd.orden_compra_id = $1
       ORDER BY ocd.id ASC`,
      [idNum]
    );

    const oc = ocQuery.rows[0];
    res.json({
      proveedor_id: oc.proveedor_id,
      proveedor_nombre: safeText(oc.proveedor_nombre || oc.proveedor_marca, 'Proveedor'),
      comentarios_finanzas: oc.comentarios_finanzas || '',
      iva_rate: oc.iva_rate,
      isr_rate: oc.isr_rate,
      impo: oc.impo,
      status: oc.status,
      es_urgente: oc.es_urgente,
      sub_total: oc.sub_total,
      iva: oc.iva,
      ret_isr: oc.ret_isr,
      total: oc.total,
      numero_oc: oc.numero_oc,
      rfq_id: oc.rfq_id,
      proyecto_id: oc.proyecto_id,
      sitio_id: oc.sitio_id,
      proyecto_nombre: oc.proyecto_nombre,
      sitio_nombre: oc.sitio_nombre,
      items: itemsQuery.rows,
    });
  } catch (error) {
    console.error('[ordenCompra] getDatosParaEditar error:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};

/* ================================================================================================
 * Endpoint: Editar una OC (PATCH /api/ocs/:id/editar)
 * Body: { motivo, proveedor_id, comentarios_finanzas, impo, iva_rate, isr_rate,
 *         items: [{id?, material_id, cantidad, precio_unitario, moneda, plazo_entrega}] }
 *   - items con id → UPDATE
 *   - items sin id (id=null) → INSERT (nuevo item)
 *   - items existentes en BD pero ausentes del array → DELETE (removidos)
 * ==============================================================================================*/
const editarOc = async (req, res) => {
  const idNum = Number(req.params.id);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro id inválido.' });
  }

  const { motivo, proveedor_id, comentarios_finanzas, items } = req.body;
  const payloadImpo = req.body.impo;
  const payloadIvaRate = req.body.iva_rate;
  const payloadIsrRate = req.body.isr_rate;

  if (!motivo || !String(motivo).trim()) {
    return res.status(400).json({ error: 'El motivo de la modificación es obligatorio.' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos una línea.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar que la OC existe y puede editarse
    const ocCheck = await client.query(
      `SELECT oc.*, p.razon_social AS proveedor_razon, p.marca AS proveedor_marca,
              proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre,
              s_e.nombre AS lugar_entrega_nombre,
              u.nombre AS usuario_nombre, u.correo AS usuario_correo,
              r.rfq_code AS rfq_code,
              d.codigo AS depto_codigo
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       JOIN proyectos proy ON oc.proyecto_id = proy.id
       JOIN sitios s ON oc.sitio_id = s.id
       LEFT JOIN sitios s_e ON s_e.id = oc.lugar_entrega::int
       JOIN usuarios u ON oc.usuario_id = u.id
       LEFT JOIN requisiciones r ON oc.rfq_id = r.id
       JOIN departamentos d ON u.departamento_id = d.id
       WHERE oc.id = $1`,
      [idNum]
    );
    if (ocCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }
    const oc = ocCheck.rows[0];
    if (['ENTREGADA', 'CANCELADA'].includes(oc.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No se puede modificar una OC con status ${oc.status}.` });
    }

    // 2) Actualizar proveedor si cambió
    const nuevaProvId = proveedor_id ? Number(proveedor_id) : oc.proveedor_id;

    let proveedorNombreFinal = safeText(oc.proveedor_razon || oc.proveedor_marca, 'PROVEEDOR');
    if (nuevaProvId !== oc.proveedor_id) {
      const provQuery = await client.query(
        `SELECT razon_social, marca FROM proveedores WHERE id = $1`,
        [nuevaProvId]
      );
      if (provQuery.rowCount > 0) {
        const p = provQuery.rows[0];
        proveedorNombreFinal = safeText(p.razon_social || p.marca, 'PROVEEDOR');
      }
    }

    // 3) Cargar items existentes de la OC para detectar eliminados
    const existingItemsQuery = await client.query(
      `SELECT id, material_id, requisicion_detalle_id, cantidad
       FROM ordenes_compra_detalle
       WHERE orden_compra_id = $1`,
      [idNum]
    );
    const existingItemsMap = new Map();
    for (const row of existingItemsQuery.rows) {
      existingItemsMap.set(row.id, row);
    }

    // Separar items en: updates (tienen id), nuevos (sin id)
    const itemsToUpdate = items.filter(it => it.id != null);
    const itemsToAdd = items.filter(it => it.id == null);
    const sentIds = new Set(itemsToUpdate.map(it => Number(it.id)));

    // 4) REMOVER items que ya no están en el payload
    for (const [existId, existRow] of existingItemsMap) {
      if (!sentIds.has(existId)) {
        // Decrement cantidad_procesada en requisiciones_detalle
        if (existRow.requisicion_detalle_id) {
          await client.query(
            `UPDATE requisiciones_detalle
             SET cantidad_procesada = GREATEST(0, COALESCE(cantidad_procesada, 0) - $1)
             WHERE id = $2`,
            [toNum(existRow.cantidad), existRow.requisicion_detalle_id]
          );
          // Reset status_compra if no longer fully processed
          await client.query(
            `UPDATE requisiciones_detalle
             SET status_compra = 'PENDIENTE'
             WHERE id = $1 AND COALESCE(cantidad_procesada, 0) < COALESCE(cantidad, 0)`,
            [existRow.requisicion_detalle_id]
          );
        }
        // Delete the OC detail row
        await client.query(
          `DELETE FROM ordenes_compra_detalle WHERE id = $1 AND orden_compra_id = $2`,
          [existId, idNum]
        );
      }
    }

    // 5) ACTUALIZAR items existentes
    const moneda = items[0]?.moneda || 'MXN';
    for (const item of itemsToUpdate) {
      const itemId = Number(item.id);
      const oldRow = existingItemsMap.get(itemId);
      const newQty = toNum(item.cantidad);
      const oldQty = oldRow ? toNum(oldRow.cantidad) : 0;

      await client.query(
        `UPDATE ordenes_compra_detalle
         SET cantidad = $1, precio_unitario = $2, moneda = $3, plazo_entrega = $4
         WHERE id = $5 AND orden_compra_id = $6`,
        [
          newQty,
          Number(item.precio_unitario),
          item.moneda || moneda,
          item.plazo_entrega || null,
          itemId,
          idNum,
        ]
      );

      // Si la cantidad cambió, ajustar cantidad_procesada en requisiciones_detalle
      if (oldRow?.requisicion_detalle_id && newQty !== oldQty) {
        const diff = newQty - oldQty;
        await client.query(
          `UPDATE requisiciones_detalle
           SET cantidad_procesada = GREATEST(0, COALESCE(cantidad_procesada, 0) + $1)
           WHERE id = $2`,
          [diff, oldRow.requisicion_detalle_id]
        );
      }
    }

    // 6) AGREGAR items nuevos
    for (const item of itemsToAdd) {
      const matId = Number(item.material_id);
      if (!matId) continue;

      // Buscar o crear requisicion_detalle para este material en la requisición vinculada
      let reqDetalleId = null;
      let rdWasCreated = false;
      if (oc.rfq_id) {
        const rdCheck = await client.query(
          `SELECT id FROM requisiciones_detalle
           WHERE requisicion_id = $1 AND material_id = $2
           LIMIT 1`,
          [oc.rfq_id, matId]
        );
        if (rdCheck.rowCount > 0) {
          reqDetalleId = rdCheck.rows[0].id;
        } else {
          // Crear nueva partida en requisiciones_detalle
          const rdInsert = await client.query(
            `INSERT INTO requisiciones_detalle
               (requisicion_id, material_id, cantidad, comentario, status_compra, cantidad_procesada)
             VALUES ($1, $2, $3, NULL, 'PROCESADO', $4)
             RETURNING id`,
            [oc.rfq_id, matId, toNum(item.cantidad), toNum(item.cantidad)]
          );
          reqDetalleId = rdInsert.rows[0].id;
          rdWasCreated = true;
        }
      }

      // Crear requisiciones_opciones para obtener un comparativa_precio_id válido
      let comparativaPrecioId = null;
      if (oc.rfq_id && reqDetalleId) {
        const opcionInsert = await client.query(
          `INSERT INTO requisiciones_opciones
             (requisicion_id, requisicion_detalle_id, proveedor_id,
              precio_unitario, cantidad_cotizada, moneda, seleccionado,
              es_precio_neto, es_importacion, es_entrega_inmediata)
           VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, true)
           RETURNING id`,
          [
            oc.rfq_id,
            reqDetalleId,
            nuevaProvId,
            toNum(item.precio_unitario),
            toNum(item.cantidad),
            item.moneda || moneda,
            payloadImpo === true,
          ]
        );
        comparativaPrecioId = opcionInsert.rows[0].id;
      }

      // Insertar en ordenes_compra_detalle
      await client.query(
        `INSERT INTO ordenes_compra_detalle
           (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id,
            cantidad, precio_unitario, moneda, plazo_entrega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          idNum,
          reqDetalleId,
          comparativaPrecioId,
          matId,
          toNum(item.cantidad),
          toNum(item.precio_unitario),
          item.moneda || moneda,
          item.plazo_entrega || null,
        ]
      );

      // Incrementar cantidad_procesada en rd pre-existente (no recién creado)
      if (reqDetalleId && !rdWasCreated) {
        await client.query(
          `UPDATE requisiciones_detalle
           SET cantidad_procesada = COALESCE(cantidad_procesada, 0) + $1
           WHERE id = $2`,
          [toNum(item.cantidad), reqDetalleId]
        );
      }
    }

    // 7) Recalcular totales usando iva_rate / isr_rate del payload o de la OC
    const esImpo = payloadImpo != null ? payloadImpo === true : oc.impo === true;
    const ivaRate = payloadIvaRate != null ? toNum(payloadIvaRate) : toNum(oc.iva_rate);
    const isrRate = payloadIsrRate != null ? toNum(payloadIsrRate) : toNum(oc.isr_rate);

    const subTotal = round4(
      items.reduce((sum, it) => sum + toNum(it.cantidad) * toNum(it.precio_unitario), 0)
    );
    const iva = (!esImpo && ivaRate > 0) ? round4(subTotal * ivaRate) : 0;
    const retIsr = (!esImpo && isrRate > 0) ? round4(subTotal * isrRate) : 0;
    const total = round4(subTotal + iva - retIsr);

    // 8) Actualizar cabecera OC
    const comentFin = typeof comentarios_finanzas === 'string' ? comentarios_finanzas.trim() || null : null;
    await client.query(
      `UPDATE ordenes_compra
       SET proveedor_id = $1, comentarios_finanzas = $2,
           sub_total = $3, iva = $4, ret_isr = $5, total = $6,
           iva_rate = $7, isr_rate = $8, impo = $9,
           actualizado_en = NOW()
       WHERE id = $10`,
      [nuevaProvId, comentFin, subTotal, iva, retIsr, total, ivaRate, isrRate, esImpo, idNum]
    );

    // 9) Fetch OC actualizada completa para PDF
    const ocPdfQuery = await client.query(
      `SELECT oc.*,
              p.razon_social AS proveedor_razon_social,
              p.marca        AS proveedor_marca,
              p.rfc          AS proveedor_rfc,
              proy.nombre    AS proyecto_nombre,
              s.nombre       AS sitio_nombre,
              s_e.nombre     AS lugar_entrega_nombre,
              u.nombre       AS usuario_nombre,
              u.correo       AS usuario_correo,
              r.rfq_code     AS rfq_code,
              (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
              NOW() AS fecha_aprobacion
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       JOIN proyectos proy ON oc.proyecto_id = proy.id
       JOIN sitios s ON oc.sitio_id = s.id
       LEFT JOIN sitios s_e ON s_e.id = oc.lugar_entrega::int
       JOIN usuarios u ON oc.usuario_id = u.id
       LEFT JOIN requisiciones r ON oc.rfq_id = r.id
       WHERE oc.id = $1`,
      [idNum]
    );
    const ocDataParaPdf = ocPdfQuery.rows[0];

    const itemsPdfQuery = await client.query(
      `SELECT ocd.*, cm.nombre AS material_nombre, cm.sku AS sku,
              cu.simbolo AS unidad_simbolo
       FROM ordenes_compra_detalle ocd
       JOIN catalogo_materiales cm ON ocd.material_id = cm.id
       JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
       WHERE ocd.orden_compra_id = $1
       ORDER BY ocd.id ASC`,
      [idNum]
    );

    // 10) Generar PDF
    const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, itemsPdfQuery.rows, client);

    // 11) Nombre del archivo
    const ocDisplay = formatOcForDisplay(oc.numero_oc);
    const sitioNombre = safeText(ocDataParaPdf.sitio_nombre, '');
    const proyectoNombre = safeText(ocDataParaPdf.proyecto_nombre, '');
    const subject = oc.es_urgente
      ? `${ocDisplay} - MODIFICADA - URGENTE - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombreFinal}`
      : `${ocDisplay} - MODIFICADA - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombreFinal}`;
    const pdfFileName = `${sanitizeFileName(subject)}.pdf`;

    // 12) Subir PDF a Drive
    const driveFile = await uploadOcPdfBuffer(
      pdfBuffer,
      pdfFileName,
      oc.depto_codigo,
      ocDataParaPdf.rfq_code || oc.numero_oc,
      oc.numero_oc
    );

    // 13) Enviar correo
    const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
    if (recipients.length > 0) {
      const motivoHtml = `<p><b>Motivo de la modificación:</b><br/>${String(motivo).replace(/\n/g, '<br/>')}</p>`;
      const notesHtml = comentFin
        ? `<p><b>Notas de finanzas:</b><br/>${comentFin.replace(/\n/g, '<br/>')}</p>`
        : '';
      const urgentHtml = oc.es_urgente
        ? `<p style="color:#C62828;font-weight:bold;font-size:14px;">URGENTE</p>`
        : '';
      const htmlBody = `
        ${urgentHtml}
        <p>La Orden de Compra <b>${ocDisplay}</b> ha sido <b>modificada</b> y requiere revisión.</p>
        <p>
          <b>OC:</b> ${ocDisplay}<br/>
          <b>Proveedor:</b> ${proveedorNombreFinal}<br/>
          <b>Sitio:</b> ${sitioNombre}<br/>
          <b>Proyecto:</b> ${proyectoNombre}
        </p>
        ${motivoHtml}
        ${notesHtml}
        ${driveFile?.webViewLink ? `<p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>` : ''}
        <p>Se adjunta la Orden de Compra actualizada.</p>
      `;
      await sendEmailWithAttachments(
        recipients,
        subject,
        htmlBody,
        [{ filename: pdfFileName, content: pdfBuffer }]
      );
    }

    await client.query('COMMIT');

    res.json({
      mensaje: `OC ${oc.numero_oc} modificada correctamente.`,
      oc: { id: idNum, numero_oc: oc.numero_oc },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ordenCompra] editarOc error:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};


module.exports = {
  descargarOcPdf,
  getOcs,
  getOcFilters,
  getDatosParaEditar,
  editarOc,
};
