// C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Descarga de PDF)
 * Fix PRO:
 * - Soporta columnas nuevas: ret_isr, iva_rate, isr_rate para PDF consistente.
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');

const descargarOcPdf = async (req, res) => {
  const { id: ocId } = req.params;

  const idNum = Number(ocId);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro ocId inválido.' });
  }

  try {
    const ocDataQuery = await pool.query(`
      SELECT oc.*, p.razon_social AS proveedor_razon_social, p.marca AS proveedor_marca, p.rfc AS proveedor_rfc,
             proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre as usuario_nombre,
             (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda,
             COALESCE(oc.fecha_creacion, NOW()) as fecha_aprobacion
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos proy ON oc.proyecto_id = proy.id
      JOIN sitios s ON oc.sitio_id = s.id
      JOIN usuarios u ON oc.usuario_id = u.id
      WHERE oc.id = $1;
    `, [idNum]);

    if (ocDataQuery.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }
    const ocData = ocDataQuery.rows[0];

    const itemsDataQuery = await pool.query(`
      SELECT ocd.*, cm.nombre AS material_nombre, cm.sku AS sku, cu.simbolo AS unidad_simbolo
      FROM ordenes_compra_detalle ocd
      JOIN catalogo_materiales cm ON ocd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ocd.orden_compra_id = $1;
    `, [idNum]);
    const itemsData = itemsDataQuery.rows;

    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData, pool);

    const numero_oc = ocData.numero_oc;
    const safeMarca = String(ocData.proveedor_marca || 'PROV').replace(/\s+/g, '_');
    const fileName = `${numero_oc}_${safeMarca}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error(`[ordenCompra.controller] Error al generar/servir PDF:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};

module.exports = {
  descargarOcPdf,
};
