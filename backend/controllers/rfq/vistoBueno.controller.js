// C:\SIRA\backend\controllers\rfq\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: VB_RFQ (Visto Bueno de Cotizaciones)
 * =================================================================================================
 * Responsabilidades:
 * - Listar RFQs pendientes por aprobar
 * - Rechazar RFQ (regresar a cotizando)
 * - Generar Órdenes de Compra desde un RFQ (por proveedor o por filtro proveedorId)
 *
 * Reglas clave:
 * - Mantiene numeración BD: ordenes_compra.numero_oc = "OC-<id>" (ej. "OC-19")
 * - Presentación (PDF/Email/Archivo): padding 4 => "OC-0019" (si >4 dígitos: "OC-12345")
 * - IVA/ISR respeta es_precio_neto + config_calculo + importación
 * - Nuevos campos por OC:
 *   - es_urgente (bool)
 *   - comentarios_finanzas (text)
 *
 * Cambios en esta versión:
 * - lugar_entrega es ID de sitios => se resuelve a nombre (sitios.nombre) como lugar_entrega_nombre
 * - Subject y filename: "OC-0019 - [URGENTE - ]{SITIO} - {PROYECTO} - {PROVEEDOR}"
 *   (sin underscores, con espacios y guiones)
 * - Email body muestra nombre de lugar de entrega (no el ID)
 * =================================================================================================
 */

const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
const { uploadOcPdfBuffer, downloadFileBuffer } = require('../../services/googleDrive');
const { sendEmailWithAttachments } = require('../../services/emailService');

/* ================================================================================================
 * Helpers: números / redondeo / strings
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
    .replace(/[\/\\?%*:|"<>]/g, '-') // inválidos en Windows
    .replace(/\s+/g, ' ')
    .replace(/\s-\s/g, ' - ')
    .trim();
};

const getProveedorNombre = (proveedorMarca, proveedorRazon) => {
  const marca = String(proveedorMarca ?? '').trim();
  if (marca) return marca;
  const razon = String(proveedorRazon ?? '').trim();
  return razon || 'PROVEEDOR';
};

/* ================================================================================================
 * Helpers: cálculo de totales (IVA/ISR)
 * ==============================================================================================*/

const normalizeConfig = (raw) => {
  let cfg = raw;

  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
  }

  cfg = cfg && typeof cfg === 'object' ? cfg : {};

  return {
    moneda: cfg.moneda || 'MXN',
    ivaRate: cfg.ivaRate != null ? toNum(cfg.ivaRate) : 0.16,
    isIvaActive: cfg.isIvaActive !== false,
    isrRate: cfg.isrRate != null ? toNum(cfg.isrRate) : 0,
    isIsrActive: cfg.isIsrActive === true,
    forcedTotal: cfg.forcedTotal != null ? toNum(cfg.forcedTotal) : 0,
    isForcedTotalActive: cfg.isForcedTotalActive === true,
  };
};

const getBaseUnitPrice = ({ precioUnitario, esPrecioNeto, ivaRate, ivaActive }) => {
  const pu = toNum(precioUnitario);
  if (!ivaActive || ivaRate <= 0) return pu;
  if (!esPrecioNeto) return pu;
  return pu / (1 + ivaRate);
};

const calcularTotalesOc = (items) => {
  if (!items || items.length === 0) {
    return { subTotal: 0, iva: 0, retIsr: 0, total: 0, ivaRate: 0, isrRate: 0, moneda: 'MXN', esImportacion: false };
  }

  const cfg = normalizeConfig(items[0]?.config_calculo);
  const esImportacion = items.some(i => i.es_importacion === true);

  const ivaActive = !esImportacion && cfg.isIvaActive && cfg.ivaRate > 0;
  const isrActive = !esImportacion && cfg.isIsrActive && cfg.isrRate > 0;

  let subTotal = 0;

  for (const it of items) {
    const qty = toNum(it.cantidad_cotizada);
    if (qty <= 0) continue;

    const basePU = getBaseUnitPrice({
      precioUnitario: it.precio_unitario,
      esPrecioNeto: it.es_precio_neto === true,
      ivaRate: cfg.ivaRate,
      ivaActive
    });

    subTotal += qty * basePU;
  }

  subTotal = round4(subTotal);
  const iva = ivaActive ? round4(subTotal * cfg.ivaRate) : 0;
  const retIsr = isrActive ? round4(subTotal * cfg.isrRate) : 0;

  const total = cfg.isForcedTotalActive ? round4(cfg.forcedTotal) : round4(subTotal + iva - retIsr);

  return {
    subTotal,
    iva,
    retIsr,
    total,
    ivaRate: ivaActive ? cfg.ivaRate : 0,
    isrRate: isrActive ? cfg.isrRate : 0,
    moneda: cfg.moneda || 'MXN',
    esImportacion
  };
};

/* ================================================================================================
 * Helpers: Notificaciones (email)
 * ==============================================================================================*/

const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
  const query = `
    SELECT u.correo
    FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
  const result = await client.query(query, [codigoGrupo]);
  return result.rows.map(row => row.correo);
};

/* ================================================================================================
 * Endpoints
 * ==============================================================================================*/

const getRfqsPorAprobar = async (_req, res) => {
  try {
    const query = `
      SELECT r.id, r.rfq_code, r.fecha_creacion,
             u.nombre AS usuario_creador,
             p.nombre AS proyecto,
             s.nombre AS sitio
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.status = 'POR_APROBAR'
      ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('[VB_RFQ] Error al obtener RFQs por aprobar:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const rechazarRfq = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE requisiciones
       SET status = 'COTIZANDO'
       WHERE id = $1 AND status = 'POR_APROBAR'
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'El RFQ no se encontró o ya no está en estado para ser rechazado.' });
    }

    res.status(200).json({ mensaje: 'El RFQ ha sido devuelto a cotización.' });
  } catch (error) {
    console.error(`[VB_RFQ] Error al rechazar RFQ ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * POST /api/rfq/:id/generar-ocs
 */
const generarOcsDesdeRfq = async (req, res) => {
  const { id: rfqId } = req.params;
  const { id: usuarioId } = req.usuarioSira;

  const { proveedorId } = req.body;

  const esUrgenteRaw = req.body.esUrgente ?? req.body.es_urgente ?? false;
  const comentariosRaw = req.body.comentariosFinanzas ?? req.body.comentarios_finanzas ?? null;

  const esUrgente = Boolean(esUrgenteRaw);
  const comentariosFinanzas = typeof comentariosRaw === 'string' ? comentariosRaw.trim() : null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1) Validar RFQ
    const rfqQuery = await client.query(
      `SELECT r.*, d.codigo as depto_codigo
       FROM requisiciones r
       JOIN departamentos d ON r.departamento_id = d.id
       WHERE r.id = $1 AND r.status = 'POR_APROBAR'
       FOR UPDATE`,
      [rfqId]
    );

    if (rfqQuery.rowCount === 0) {
      throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
    }

    const rfqData = rfqQuery.rows[0];

    // Resolver nombre de lugar de entrega (sitios) para email
    const lugarEntregaNombreQuery = await client.query(
      `SELECT nombre FROM sitios WHERE id = $1`,
      [Number(rfqData.lugar_entrega)]
    );
    const lugarEntregaNombre = lugarEntregaNombreQuery.rowCount > 0
      ? lugarEntregaNombreQuery.rows[0].nombre
      : null;

    // 2) Opciones bloqueadas
    const opcionesBloqueadasQuery = await client.query(
      `SELECT comparativa_precio_id
       FROM ordenes_compra_detalle
       WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE rfq_id = $1)`,
      [rfqId]
    );

    const opcionesBloqueadas = opcionesBloqueadasQuery.rows.map(row => Number(row.comparativa_precio_id));

    // 3) Opciones seleccionadas
    let opcionesQueryString = `
      SELECT ro.*,
             p.marca        as proveedor_marca,
             p.razon_social as proveedor_razon_social,
             p.correo       as proveedor_correo
      FROM requisiciones_opciones ro
      JOIN proveedores p ON ro.proveedor_id = p.id
      WHERE ro.requisicion_id = $1
        AND ro.seleccionado = TRUE
    `;

    const queryParams = [rfqId];

    if (proveedorId) {
      opcionesQueryString += ` AND ro.proveedor_id = $2`;
      queryParams.push(proveedorId);
    }

    if (opcionesBloqueadas.length > 0) {
      opcionesQueryString += ` AND ro.id NOT IN (${opcionesBloqueadas.join(',')})`;
    }

    const opcionesQuery = await client.query(opcionesQueryString, queryParams);

    if (opcionesQuery.rows.length === 0) {
      throw new Error('No hay opciones pendientes para generar OC para este proveedor.');
    }

    // 4) Agrupar por proveedor
    const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
      (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
      return acc;
    }, {});

    const ocsGeneradasInfo = [];

    for (const provId in comprasPorProveedor) {
      const items = comprasPorProveedor[provId];
      const primerItem = items[0];

      const tot = calcularTotalesOc(items);

      const seqResult = await client.query(`SELECT nextval('ordenes_compra_id_seq') AS id`);
      const nuevaOcId = seqResult.rows[0].id;
      const numeroOcDb = `OC-${nuevaOcId}`;
      const numeroOcDisplay = formatOcForDisplay(numeroOcDb);

      await client.query(
        `INSERT INTO ordenes_compra
          (id, numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega,
           sub_total, iva, ret_isr, total, iva_rate, isr_rate,
           impo, status, proveedor_id,
           es_urgente, comentarios_finanzas)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13,
           $14, 'POR_AUTORIZAR', $15,
           $16, $17)`,
        [
          nuevaOcId,
          numeroOcDb,
          usuarioId,
          rfqId,
          rfqData.sitio_id,
          rfqData.proyecto_id,
          rfqData.lugar_entrega,
          tot.subTotal,
          tot.iva,
          tot.retIsr,
          tot.total,
          tot.ivaRate,
          tot.isrRate,
          tot.esImportacion,
          provId,
          esUrgente,
          comentariosFinanzas
        ]
      );

      for (const item of items) {
        const cfg = normalizeConfig(item.config_calculo);
        const esImportacion = item.es_importacion === true;
        const ivaActive = !esImportacion && cfg.isIvaActive && cfg.ivaRate > 0;

        const basePU = getBaseUnitPrice({
          precioUnitario: item.precio_unitario,
          esPrecioNeto: item.es_precio_neto === true,
          ivaRate: cfg.ivaRate,
          ivaActive
        });

        await client.query(
          `INSERT INTO ordenes_compra_detalle
            (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id,
             cantidad, precio_unitario, moneda, plazo_entrega)
           VALUES
            ($1, $2, $3, (SELECT material_id FROM requisiciones_detalle WHERE id = $2),
             $4, $5, $6, $7)`,
          [
            nuevaOcId,
            item.requisicion_detalle_id,
            item.id,
            item.cantidad_cotizada,
            round4(basePU),
            item.moneda,
            item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null
          ]
        );

        await client.query(
          `UPDATE requisiciones_detalle
           SET cantidad_procesada = cantidad_procesada + $1
           WHERE id = $2`,
          [item.cantidad_cotizada, item.requisicion_detalle_id]
        );

        await client.query(
          `UPDATE requisiciones_detalle
           SET status_compra = $1
           WHERE id = $2 AND cantidad_procesada >= cantidad`,
          [nuevaOcId, item.requisicion_detalle_id]
        );
      }

      // ========= PDF data con lugar_entrega_nombre =========
      const ocDataQuery = await client.query(
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
          NOW() AS fecha_aprobacion
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        JOIN proyectos proy ON oc.proyecto_id = proy.id
        JOIN sitios s ON oc.sitio_id = s.id
        LEFT JOIN sitios s_entrega ON s_entrega.id = oc.lugar_entrega::int
        JOIN usuarios u ON oc.usuario_id = u.id
        JOIN requisiciones r ON oc.rfq_id = r.id
        WHERE oc.id = $1;
        `,
        [nuevaOcId]
      );

      const ocDataParaPdf = ocDataQuery.rows[0];

      const monedaDistinct = await client.query(
        `SELECT COUNT(DISTINCT moneda)::int AS cnt
         FROM ordenes_compra_detalle
         WHERE orden_compra_id = $1`,
        [nuevaOcId]
      );
      if ((monedaDistinct.rows[0]?.cnt ?? 1) > 1) {
        throw new Error(`La OC ${numeroOcDb} tiene múltiples monedas. Esto no está permitido.`);
      }

      const itemsDataQuery = await client.query(
        `
        SELECT ocd.*,
               cm.nombre AS material_nombre,
               cm.sku    AS sku,
               cu.simbolo AS unidad_simbolo
        FROM ordenes_compra_detalle ocd
        JOIN catalogo_materiales cm ON ocd.material_id = cm.id
        JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
        WHERE ocd.orden_compra_id = $1;
        `,
        [nuevaOcId]
      );

      const pdfItems = itemsDataQuery.rows;

      const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, pdfItems, client);

      // ========= Subject / filename requerido =========
      const proveedorNombre = getProveedorNombre(primerItem.proveedor_marca, primerItem.proveedor_razon_social);
      const sitioNombre = safeText(ocDataParaPdf.sitio_nombre, '');
      const proyectoNombre = safeText(ocDataParaPdf.proyecto_nombre, '');

      // URGENTE después del consecutivo
      const subject = esUrgente
        ? `${numeroOcDisplay} - URGENTE - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombre}`
        : `${numeroOcDisplay} - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombre}`;

      const pdfFileName = `${sanitizeFileName(subject)}.pdf`;

      const driveFile = await uploadOcPdfBuffer(
        pdfBuffer,
        pdfFileName,
        rfqData.depto_codigo,
        rfqData.numero_requisicion,
        numeroOcDb
      );

      if (!driveFile || !driveFile.webViewLink) {
        throw new Error('Falló la subida del archivo PDF a Google Drive o no se recibió el link de vuelta.');
      }

      const attachments = [{ filename: pdfFileName, content: pdfBuffer }];

      const quoteFilesQuery = await client.query(
        `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
        [provId, rfqId]
      );

      for (const file of quoteFilesQuery.rows) {
        try {
          const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
          const fileBuffer = await downloadFileBuffer(fileId);
          attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
        } catch (downloadError) {
          console.error(`[VB_RFQ] No se pudo adjuntar ${file.nombre_archivo} de Drive.`, downloadError);
        }
      }

      const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);

      if (recipients.length > 0) {
        const notesHtml = comentariosFinanzas
          ? `<p><b>Notas de finanzas:</b><br/>${comentariosFinanzas.replace(/\n/g, '<br/>')}</p>`
          : '';

        const urgentHtml = esUrgente
          ? `<p style="color:#C62828;font-weight:bold;font-size:14px;">URGENTE</p>`
          : '';

        const htmlBody = `
          ${urgentHtml}
          <p>Se generó una Orden de Compra y requiere autorización final.</p>
          <p>
            <b>OC:</b> ${numeroOcDisplay}<br/>
            <b>Proveedor:</b> ${proveedorNombre}<br/>
            <b>Sitio:</b> ${sitioNombre}<br/>
            <b>Proyecto:</b> ${proyectoNombre}<br/>
            <b>RFQ:</b> ${safeText(rfqData.rfq_code, 'N/D')}<br/>
            <b>Lugar de entrega:</b> ${safeText(lugarEntregaNombre, safeText(rfqData.lugar_entrega, 'N/D'))}
          </p>
          ${notesHtml}
          <p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>
          <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
        `;

        await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
      }

      ocsGeneradasInfo.push({ numero_oc: numeroOcDb, id: nuevaOcId });
    }

    const checkCompletion = await client.query(
      `SELECT COUNT(*) FROM requisiciones_detalle
       WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`,
      [rfqId]
    );

    if (checkCompletion.rows[0].count === '0') {
      await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
    }

    await client.query('COMMIT');

    res.status(200).json({
      mensaje: `Proceso completado. OCs generadas: ${ocsGeneradasInfo.map(oc => oc.numero_oc).join(', ')}.`,
      ocs: ocsGeneradasInfo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[VB_RFQ] Error al generar OCs para RFQ ${rfqId}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getRfqsPorAprobar,
  rechazarRfq,
  generarOcsDesdeRfq,
};
