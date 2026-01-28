// C:\SIRA\backend\services\ocAuthorizationService.js
/**
 * =================================================================================================
 * SERVICIO MAESTRO: Creación + Distribución de Órdenes de Compra (OC)
 * =================================================================================================
 * ¿Qué hace este servicio?
 * - Crea una OC (cabecera + detalle) a partir de opciones seleccionadas de un RFQ
 * - Genera el PDF (con background corporativo y reglas visuales)
 * - Sube PDF + adjuntos de cotización a Google Drive
 * - Notifica por email a un grupo configurado (OC_GENERADA_NOTIFICAR)
 * - TODO lo anterior dentro de UNA transacción (consistencia)
 *
 * Reglas importantes (alineadas a tu requerimiento actual):
 * - En BD `ordenes_compra.numero_oc` se guarda como "OC-<id>" (ej. "OC-19")
 * - Presentación (PDF/email/archivo): "OC-0019" (padding 4) sin duplicados tipo "OC OC-19"
 * - La OC NO puede contener múltiples monedas en su detalle (validación)
 * - Campos por OC:
 *    - es_urgente (bool)
 *    - comentarios_finanzas (text)
 * - Email:
 *    - Subject: "[URGENTE - ]OC-0019 - {SITIO} - {PROYECTO} - {PROVEEDOR}"
 *    - Adjuntos: PDF + respaldos de cotización (si existen)
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('./purchaseOrderPdfService');
const { uploadOcPdfBuffer, downloadFileBuffer } = require('./googleDrive');
const { sendEmailWithAttachments } = require('./emailService');

/* ================================================================================================
 * Helpers: utilidades básicas
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
 * Presentación uniforme:
 * - "OC-19"  -> "OC-0019"
 * - "19"     -> "OC-0019"
 * - "OC-12345" -> "OC-12345"
 */
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
    .replace(/[\/\\?%*:|"<>]/g, '-') // inválidos en Windows
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
};

const getProveedorNombre = (marca, razon) => {
  const m = String(marca ?? '').trim();
  if (m) return m;
  const r = String(razon ?? '').trim();
  return r || 'PROVEEDOR';
};

/* ================================================================================================
 * Helpers: cálculo IVA/ISR (consistente)
 * ==============================================================================================*/

const normalizeConfig = (raw) => {
  let cfg = raw;

  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
  }

  cfg = cfg && typeof cfg === 'object' ? cfg : {};

  return {
    ivaRate: cfg.ivaRate != null ? toNum(cfg.ivaRate) : 0.16,
    isIvaActive: cfg.isIvaActive !== false,
    isrRate: cfg.isrRate != null ? toNum(cfg.isrRate) : 0,
    isIsrActive: cfg.isIsrActive === true,
  };
};

/**
 * Convierte precio unitario capturado a base si el precio fue capturado "con IVA incluido".
 * Si es_precio_neto = true:
 *   precioCapturado = base * (1 + ivaRate)  => base = precioCapturado / (1 + ivaRate)
 */
const getBaseUnitPrice = ({ precioUnitario, esPrecioNeto, ivaRate, ivaActive }) => {
  const pu = toNum(precioUnitario);
  if (!ivaActive || ivaRate <= 0) return pu;
  if (!esPrecioNeto) return pu;
  return pu / (1 + ivaRate);
};

const calcularTotalesOc = (items) => {
  if (!items || items.length === 0) {
    return { subTotal: 0, iva: 0, retIsr: 0, total: 0, ivaRate: 0, isrRate: 0, esImportacion: false };
  }

  const cfg = normalizeConfig(items[0]?.config_calculo);
  const esImportacion = items.some(i => i.es_importacion === true);

  // Regla: si es importación => IVA/ISR desactivados
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
      ivaActive,
    });

    subTotal += qty * basePU;
  }

  subTotal = round4(subTotal);
  const iva = ivaActive ? round4(subTotal * cfg.ivaRate) : 0;
  const retIsr = isrActive ? round4(subTotal * cfg.isrRate) : 0;
  const total = round4(subTotal + iva - retIsr);

  return {
    subTotal,
    iva,
    retIsr,
    total,
    ivaRate: ivaActive ? cfg.ivaRate : 0,
    isrRate: isrActive ? cfg.isrRate : 0,
    esImportacion,
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
 * FUNCIÓN PRINCIPAL
 * ==============================================================================================*/

/**
 * Crea una OC a partir de opciones seleccionadas (requisiciones_opciones.id) para un RFQ.
 *
 * Firma compat (no rompe llamadas viejas):
 *   createAndAuthorizeOC({ rfqId, usuarioId, opcionIds, rfqData })
 *
 * Nuevos campos opcionales:
 *   - esUrgente (bool)
 *   - comentariosFinanzas (string)
 */
const createAndAuthorizeOC = async ({
  rfqId,
  usuarioId,
  opcionIds,
  rfqData,
  esUrgente = false,
  comentariosFinanzas = null,
}) => {
  if (!opcionIds || opcionIds.length === 0) {
    throw new Error('Se requiere al menos una opción seleccionada para generar la OC.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1) Traer opciones seleccionadas y validar pertenencia al RFQ
    const opcionesQuery = await client.query(
      `
      SELECT
        ro.*,
        rd.material_id,
        p.marca        AS proveedor_marca,
        p.razon_social AS proveedor_razon_social,
        p.correo       AS proveedor_correo
      FROM requisiciones_opciones ro
      JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id
      JOIN proveedores p           ON ro.proveedor_id = p.id
      WHERE ro.id = ANY($1::int[])
        AND ro.requisicion_id = $2
      `,
      [opcionIds, rfqId]
    );

    const items = opcionesQuery.rows;

    if (items.length === 0) {
      throw new Error('Las opciones seleccionadas no son válidas o no pertenecen al RFQ especificado.');
    }

    // Todas estas opciones deben ser del mismo proveedor para una sola OC
    const primerItem = items[0];
    const { proveedor_id, proveedor_marca, proveedor_razon_social } = primerItem;

    // 2) Calcular totales coherentes (base/IVA/ISR + importación)
    const tot = calcularTotalesOc(items);

    // 3) Insert cabecera OC (CTE para id atómico)
    //    Nota: Guardamos numero_oc en BD como "OC-<id>" (ej. "OC-19")
    const ocInsertResult = await client.query(
      `
      WITH seq AS (SELECT nextval('ordenes_compra_id_seq') AS id)
      INSERT INTO ordenes_compra
        (id, numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega,
         sub_total, iva, ret_isr, total, iva_rate, isr_rate,
         impo, status, proveedor_id,
         es_urgente, comentarios_finanzas)
      SELECT
        seq.id,
        ('OC-' || seq.id::text),
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, 'POR_AUTORIZAR', $13,
        $14, $15
      FROM seq
      RETURNING id, numero_oc
      `,
      [
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
        proveedor_id,
        Boolean(esUrgente),
        typeof comentariosFinanzas === 'string' ? comentariosFinanzas.trim() : null,
      ]
    );

    const nuevaOc = ocInsertResult.rows[0]; // { id, numero_oc } donde numero_oc = "OC-19"
    const nuevaOcId = nuevaOc.id;
    const numeroOcDb = nuevaOc.numero_oc; // "OC-19"
    const numeroOcDisplay = formatOcForDisplay(numeroOcDb); // "OC-0019"

    // 4) Insert detalle de OC + actualización de requisición (status_compra)
    for (const it of items) {
      const cfg = normalizeConfig(it.config_calculo);
      const esImportacion = it.es_importacion === true;

      const ivaActive = !esImportacion && cfg.isIvaActive && cfg.ivaRate > 0;
      const basePU = getBaseUnitPrice({
        precioUnitario: it.precio_unitario,
        esPrecioNeto: it.es_precio_neto === true,
        ivaRate: cfg.ivaRate,
        ivaActive,
      });

      await client.query(
        `
        INSERT INTO ordenes_compra_detalle
          (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id,
           cantidad, precio_unitario, moneda, plazo_entrega)
        VALUES
          ($1, $2, $3, $4,
           $5, $6, $7, $8)
        `,
        [
          nuevaOcId,
          it.requisicion_detalle_id,
          it.id,
          it.material_id,
          it.cantidad_cotizada,
          round4(basePU),
          it.moneda,
          it.tiempo_entrega_valor ? `${it.tiempo_entrega_valor} ${it.tiempo_entrega_unidad}` : null,
        ]
      );

      // Marcamos la línea como comprada con el ID de la OC (tu modelo lo usa así)
      await client.query(
        `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
        [nuevaOcId, it.requisicion_detalle_id]
      );
    }

    // 5) Validación: una OC debe tener una sola moneda
    const monedaDistinct = await client.query(
      `SELECT COUNT(DISTINCT moneda)::int AS cnt
       FROM ordenes_compra_detalle
       WHERE orden_compra_id = $1`,
      [nuevaOcId]
    );

    if ((monedaDistinct.rows[0]?.cnt ?? 1) > 1) {
      throw new Error(`La OC ${numeroOcDb} tiene múltiples monedas. Esto no está permitido.`);
    }

    // 6) Traer ocData e itemsData para el PDF (JOINs completos + usuario_correo + rfq_code)
    const ocDataQuery = await client.query(
      `
      SELECT
        oc.*,
        p.razon_social AS proveedor_razon_social,
        p.marca        AS proveedor_marca,
        p.rfc          AS proveedor_rfc,
        proy.nombre    AS proyecto_nombre,
        s.nombre       AS sitio_nombre,
        u.nombre       AS usuario_nombre,
        u.correo       AS usuario_correo,
        r.rfq_code     AS rfq_code,
        (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
        COALESCE(oc.fecha_aprobacion, oc.fecha_creacion, NOW()) AS fecha_aprobacion
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos proy ON oc.proyecto_id = proy.id
      JOIN sitios s ON oc.sitio_id = s.id
      JOIN usuarios u ON oc.usuario_id = u.id
      LEFT JOIN requisiciones r ON oc.rfq_id = r.id
      WHERE oc.id = $1;
      `,
      [nuevaOcId]
    );

    const ocData = ocDataQuery.rows[0];

    const itemsDataQuery = await client.query(
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
      [nuevaOcId]
    );

    const itemsData = itemsDataQuery.rows;

    // 7) Generar PDF (firma nueva: ocData + itemsData)
    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData, client);

    // 8) Subject / filename (sanitizado)
    const proveedorNombre = getProveedorNombre(proveedor_marca, proveedor_razon_social);
    const sitioNombre = safeText(ocData.sitio_nombre, '');
    const proyectoNombre = safeText(ocData.proyecto_nombre, '');

    const subjectBase = `${numeroOcDisplay} - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombre}`;
    const subject = ocData.es_urgente === true ? `URGENTE - ${subjectBase}` : subjectBase;
    const fileName = `${sanitizeFileName(subject)}.pdf`;

    // 9) Subir a Drive (estructura por requisición)
    const driveFile = await uploadOcPdfBuffer(
      pdfBuffer,
      fileName,
      rfqData.depto_codigo,
      rfqData.numero_requisicion,
      numeroOcDb
    );

    if (!driveFile || !driveFile.fileLink) {
      throw new Error('Falló la subida del PDF a Drive o no se recibió el link de vuelta.');
    }

    // 10) Adjuntar respaldos de cotización (si existen)
    const attachments = [{ filename: fileName, content: pdfBuffer }];

    const quoteFilesQuery = await client.query(
      `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
      [proveedor_id, rfqId]
    );

    for (const file of quoteFilesQuery.rows) {
      try {
        const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
        const fileBuffer = await downloadFileBuffer(fileId);
        attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
      } catch (downloadError) {
        console.error(`[OC Service] No se pudo adjuntar ${file.nombre_archivo} de Drive.`, downloadError);
      }
    }

    // 11) Notificación por correo al grupo
    const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
    if (recipients.length > 0) {
      const urgentHtml = ocData.es_urgente === true
        ? `<p style="color:#C62828;font-weight:bold;font-size:14px;">URGENTE</p>`
        : '';

      const notes = String(ocData.comentarios_finanzas ?? '').trim();
      const notesHtml = notes
        ? `<p><b>Notas de finanzas:</b><br/>${notes.replace(/\n/g, '<br/>')}</p>`
        : '';

      const htmlBody = `
        ${urgentHtml}
        <p>Se ha generado una Orden de Compra y requiere autorización final.</p>
        <p>
          <b>OC:</b> ${numeroOcDisplay}<br/>
          <b>Proveedor:</b> ${proveedorNombre}<br/>
          <b>Sitio:</b> ${sitioNombre}<br/>
          <b>Proyecto:</b> ${proyectoNombre}<br/>
          <b>RFQ:</b> ${safeText(ocData.rfq_code, 'N/D')}<br/>
          <b>Lugar de entrega:</b> ${safeText(ocData.lugar_entrega, 'N/D')}
        </p>
        ${notesHtml}
        <p>Link a Carpeta de Drive: <a href="${driveFile.folderLink}">Ver Archivos</a></p>
        <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
      `;

      await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
    }

    await client.query('COMMIT');

    return {
      ...nuevaOc, // { id, numero_oc } con numero_oc = "OC-19"
      mensaje: `OC ${numeroOcDisplay} generada y enviada.`,
    };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[OC Service] Error en transacción:', err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Alias para compatibilidad con imports antiguos.
 */
const authorizeAndDistributeOC = (...args) => createAndAuthorizeOC(...args);

module.exports = {
  createAndAuthorizeOC,
  authorizeAndDistributeOC,
};
