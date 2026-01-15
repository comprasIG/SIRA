// C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Descarga de PDF) - (Versión 2.1 - Corrección BD)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Maneja la descarga de PDFs de OC.
 * --- HISTORIAL DE CAMBIOS ---
 * v2.1: Se alinea con el DDL. El query ya no busca 'oc.fecha_aprobacion' (que no existe)
 * y en su lugar usa 'oc.fecha_creacion' como la fecha para el documento.
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

  const db = pool; 

  try {
    
    // ==================================================================
    // --- INICIO DE LA CORRECCIÓN (BUG: 'fecha_aprobacion' no existe) ---
    // ==================================================================

    // 1. Obtener cabecera completa de la OC
    // (RF) Se cambió 'oc.fecha_aprobacion' por 'oc.fecha_creacion'
    const ocDataQuery = await db.query(`
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
    
    // ==================================================================
    // --- FIN DE LA CORRECCIÓN ---
    // ==================================================================
    
    if (ocDataQuery.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }
    const ocData = ocDataQuery.rows[0];

    // 2. Obtener items (materiales) completos de la OC
    const itemsDataQuery = await db.query(`
        SELECT ocd.*, cm.nombre AS material_nombre, cm.sku AS sku, cu.simbolo AS unidad_simbolo
    FROM ordenes_compra_detalle ocd
    JOIN catalogo_materiales cm ON ocd.material_id = cm.id
    JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
    WHERE ocd.orden_compra_id = $1;
    `, [idNum]);
    const itemsData = itemsDataQuery.rows;

    // 3. Generar PDF
    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData, db);

    // 4. Corregir nombre del archivo
    const numero_oc = ocData.numero_oc; // Ej: 'OC-288'
    const safeMarca = String(ocData.proveedor_marca || 'PROV').replace(/\s+/g, '_');
    const fileName = `${numero_oc}_${safeMarca}.pdf`; // Ej: 'OC-288_PROV.pdf'

    // 5. Enviar archivo
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
  // (Mantener el resto de tus funciones si existen)
};
