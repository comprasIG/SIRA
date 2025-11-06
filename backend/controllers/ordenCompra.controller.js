// C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Descarga de PDF)
 * Opción A — Limpieza total: sin flujo legacy de creación/autorizar (ocCreationService eliminado)
 * =================================================================================================
 * Endpoints expuestos:
 * - GET /api/ocs/:id/pdf   -> Descargar PDF de la OC
 *
 * Notas:
 * - La creación/autorización de OCs ocurre vía vistoBueno.controller -> ocAuthorizationService
 * - Aquí solo servimos el PDF on-demand con un nombre consistente "OC-<numero>_<marca>.pdf"
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');

/**
 * GET /api/ocs/:id/pdf
 * Genera y devuelve el PDF de una OC específica para su descarga directa.
 */
const descargarOcPdf = async (req, res) => {
  const { id: ocId } = req.params;

  const idNum = Number(ocId);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro ocId inválido.' });
  }

  try {
    // 1) Obtenemos datos para nombrar el archivo
    const metaQ = await pool.query(
      `SELECT oc.numero_oc, COALESCE(p.marca, 'PROV') AS proveedor_marca
         FROM ordenes_compra oc
         JOIN proveedores p ON p.id = oc.proveedor_id
        WHERE oc.id = $1`,
      [idNum]
    );
    if (metaQ.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }
    const { numero_oc, proveedor_marca } = metaQ.rows[0];
    const safeMarca = String(proveedor_marca || 'PROV').replace(/\s+/g, '_');
    const fileName = `OC-${numero_oc}_${safeMarca}.pdf`; // numero_oc es solo el número

    // 2) Generar PDF
    const pdfBuffer = await generatePurchaseOrderPdf(idNum);

    // 3) Enviar archivo
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    });
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('[ordenCompra.controller] Error al generar/servir PDF:', error);
    return res.status(500).json({ error: 'No se pudo generar el PDF de la OC.' });
  }
};

module.exports = {
  descargarOcPdf,
};
