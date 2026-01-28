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
 * - Presentación (nombre de archivo y PDF): "OC-0019" (padding 4) y sin duplicados tipo "OC OC-19".
 * - El nombre del archivo debe coincidir con el formato del subject:
 *     "[URGENTE - ]OC-0019 - {SITIO} - {PROYECTO} - {PROVEEDOR}.pdf"
 * - La OC NO puede tener múltiples monedas en su detalle (validación).
 * - El correo del usuario (usuarios.correo) solo se muestra en el PDF, no en emails aquí.
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');

/* ================================================================================================
 * Helpers
 * ==============================================================================================*/

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

const sanitizeFileName = (s) => {
  return String(s ?? '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '-') // inválidos en Windows
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
};

const getProveedorNombre = (oc) => {
  const marca = String(oc?.proveedor_marca ?? '').trim();
  if (marca) return marca;
  const razon = String(oc?.proveedor_razon_social ?? '').trim();
  return razon || 'PROVEEDOR';
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
    const ocDataQuery = await pool.query(
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

    // 5) Construir nombre de archivo (igual que el subject)
    const ocDisplay = formatOcForDisplay(ocData.numero_oc);
    const sitio = safeText(ocData.sitio_nombre, '');
    const proyecto = safeText(ocData.proyecto_nombre, '');
    const proveedor = getProveedorNombre(ocData);

    const subjectBase = `${ocDisplay} - ${sitio} - ${proyecto} - ${proveedor}`;
    const subject = ocData.es_urgente === true ? `URGENTE - ${subjectBase}` : subjectBase;

    const fileName = `${sanitizeFileName(subject)}.pdf`;

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

module.exports = {
  descargarOcPdf,
};
