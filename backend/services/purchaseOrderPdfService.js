//C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDFs para Órdenes de Compra
 * =================================================================================================
 * @file purchaseOrderPdfService.js
 * @description Utiliza la librería PDFKit para generar un documento PDF profesional
 * para una Orden de Compra específica, basado en los datos de la base de datos.
 */

// --- Importaciones ---
const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../db/pool'); // Para consultar la base de datos

// --- Funciones de Ayuda para Dibujar el PDF ---

function drawHeader(doc, oc) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (require('fs').existsSync(logoPath)) {
    doc.image(logoPath, 40, 35, { width: 60 });
  }
  
  doc.fillColor('#002D62').fontSize(20).font('Helvetica-Bold').text('ORDEN DE COMPRA', 0, 50, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black');
  doc.text(`Número OC: ${oc.numero_oc}`, 400, 50, { align: 'right' });
  doc.text(`Fecha de Aprobación: ${new Date(oc.fecha_aprobacion).toLocaleDateString('es-MX')}`, 400, 65, { align: 'right' });
}

function drawProviderAndShippingInfo(doc, oc) {
  let currentY = 130;
  doc.fontSize(12).fillColor('#002D62').font('Helvetica-Bold').text('Proveedor', 45, currentY);
  doc.fontSize(12).fillColor('#002D62').font('Helvetica-Bold').text('Enviar a', 320, currentY);
  currentY += 15;
  
  doc.font('Helvetica').fontSize(10).fillColor('black');
  const providerInfo = `${oc.proveedor_razon_social}\n${oc.proveedor_rfc}\n${oc.proveedor_direccion || ''}`;
  const shippingInfo = `${oc.proyecto}\n${oc.sitio}\n${oc.lugar_entrega}`;
  
  doc.text(providerInfo, 45, currentY, { width: 250 });
  doc.text(shippingInfo, 320, currentY, { width: 250 });
  
  return doc.y + 20; // Devuelve la nueva posición Y
}

function drawItemsTable(doc, items, startY) {
  let currentY = startY;
  const tableTop = currentY;
  const tableHeaders = ['Material', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total'];
  
  // Dibuja el encabezado de la tabla
  doc.rect(40, tableTop - 5, 532, 20).fillAndStroke('#F3F4F6', '#F3F4F6');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#002D62');
  doc.text(tableHeaders[0], 45, tableTop, { width: 240 });
  doc.text(tableHeaders[1], 300, tableTop, { width: 50, align: 'center' });
  doc.text(tableHeaders[2], 350, tableTop, { width: 60, align: 'center' });
  doc.text(tableHeaders[3], 410, tableTop, { width: 80, align: 'right' });
  doc.text(tableHeaders[4], 490, tableTop, { width: 80, align: 'right' });
  
  currentY = tableTop + 25;
  doc.font('Helvetica').fontSize(10).fillColor('black');

  items.forEach(item => {
    const itemTotal = (item.cantidad * item.precio_unitario).toFixed(2);
    const rowHeight = doc.heightOfString(item.material_nombre, { width: 240 }) + 10;
    
    // Paginación si es necesario
    if (currentY + rowHeight > doc.page.height - 150) { // Margen para totales y pie de página
      doc.addPage();
      currentY = 40;
    }
    
    doc.text(item.material_nombre, 45, currentY, { width: 240 });
    doc.text(Number(item.cantidad).toFixed(2), 300, currentY, { width: 50, align: 'center' });
    doc.text(item.unidad_simbolo, 350, currentY, { width: 60, align: 'center' });
    doc.text(`$${Number(item.precio_unitario).toFixed(2)}`, 410, currentY, { width: 80, align: 'right' });
    doc.text(`$${itemTotal}`, 490, currentY, { width: 80, align: 'right' });
    
    currentY += rowHeight;
    doc.moveTo(40, currentY - 5).lineTo(572, currentY - 5).strokeColor('#EEEEEE').stroke();
  });
  return currentY;
}

function drawTotals(doc, oc, startY) {
    let currentY = startY + 10;
    const rightAlignX = 490;
    const labelWidth = 80;
    
    doc.font('Helvetica');
    doc.text('Subtotal:', rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
    doc.text(`$${Number(oc.sub_total).toFixed(2)}`, rightAlignX, currentY, { width: 80, align: 'right' });
    currentY += 15;
    
    doc.text('IVA (16%):', rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
    doc.text(`$${Number(oc.iva).toFixed(2)}`, rightAlignX, currentY, { width: 80, align: 'right' });
    currentY += 15;
    
    doc.font('Helvetica-Bold');
    doc.text('Total:', rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
    doc.text(`$${Number(oc.total).toFixed(2)} ${oc.moneda}`, rightAlignX, currentY, { width: 80, align: 'right' });
    
    return currentY + 20;
}

function drawFooter(doc) {
    const pageBottom = doc.page.height - 70;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#555555')
        .text('Este documento es una Orden de Compra oficial. Sujeto a términos y condiciones.', 0, pageBottom, { align: 'center' })
        .text('Documento generado por SIRA - Sistema Integral de Requisiciones y Abastecimiento', 0, pageBottom + 10, { align: 'center' });
}

/**
 * @description Orquesta la generación del PDF para una Orden de Compra.
 * @param {number} ocId - El ID de la Orden de Compra a generar.
 * @returns {Promise<Buffer>} Una promesa que se resuelve con el Buffer del PDF generado.
 */
const generatePurchaseOrderPdf = async (ocId) => {
  // 1. Obtener todos los datos necesarios de la BD.
  const ocQuery = await pool.query(`
    SELECT 
        oc.*, 
        p.razon_social AS proveedor_razon_social, p.rfc AS proveedor_rfc, p.direccion AS proveedor_direccion,
        proy.nombre AS proyecto, s.nombre AS sitio,
        (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda,
        NOW() as fecha_aprobacion
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN proyectos proy ON oc.proyecto_id = proy.id
    JOIN sitios s ON oc.sitio_id = s.id
    WHERE oc.id = $1;
  `, [ocId]);
  if (ocQuery.rows.length === 0) throw new Error(`Orden de Compra con ID ${ocId} no encontrada.`);
  const ocData = ocQuery.rows[0];

  const itemsQuery = await pool.query(`
    SELECT 
        ocd.*,
        cm.nombre AS material_nombre,
        cu.simbolo AS unidad_simbolo
    FROM ordenes_compra_detalle ocd
    JOIN catalogo_materiales cm ON ocd.material_id = cm.id
    JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
    WHERE ocd.orden_compra_id = $1;
  `, [ocId]);
  const itemsData = itemsQuery.rows;

  // 2. Generar el PDF
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'letter', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      drawHeader(doc, ocData);
      let currentY = drawProviderAndShippingInfo(doc, ocData);
      currentY = drawItemsTable(doc, itemsData, currentY);
      currentY = drawTotals(doc, ocData, currentY);
      
      // Añadir pie de página a todas las páginas generadas.
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.count; i++) {
          doc.switchToPage(i);
          drawFooter(doc);
      }
      
      doc.end();
    } catch (error) {
      console.error("Error al generar el PDF de la OC:", error);
      reject(error);
    }
  });
};

module.exports = { generatePurchaseOrderPdf };