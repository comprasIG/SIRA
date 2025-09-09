//C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDFs para Órdenes de Compra (Versión Final y Robusta)
 * =================================================================================================
 * @file purchaseOrderPdfService.js
 * @description Utiliza la librería PDFKit para generar un documento PDF profesional
 * para una Orden de Compra. Esta versión está optimizada para prevenir la creación
 * de documentos en blanco mediante un manejo robusto de streams.
 */

// --- Importaciones ---
const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../db/pool');

// ===============================================================================================
// --- Funciones de Ayuda para Dibujar el PDF ---
// ===============================================================================================

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

function drawInfoSection(doc, oc) {
  let currentY = 130;
  doc.fontSize(11).fillColor('#002D62').font('Helvetica-Bold');
  doc.text('Proveedor:', 45, currentY);
  doc.text('Información de Entrega:', 320, currentY);
  currentY += 15;
  
  doc.font('Helvetica').fontSize(10).fillColor('black');
  const providerInfo = `${oc.proveedor_razon_social || ''}\n${oc.proveedor_rfc || ''}`;
  doc.text(providerInfo, 45, currentY, { width: 250 });

  doc.font('Helvetica-Bold').text('Sitio:', 320, currentY, { continued: true }).font('Helvetica').text(` ${oc.sitio_nombre || ''}`);
  currentY += 15;
  doc.font('Helvetica-Bold').text('Proyecto:', 320, currentY, { continued: true }).font('Helvetica').text(` ${oc.proyecto_nombre || ''}`);
  currentY += 15;
  doc.font('Helvetica-Bold').text('Generado por:', 320, currentY, { continued: true }).font('Helvetica').text(` ${oc.usuario_nombre || ''}`);
  
  return doc.y + 25;
}

function drawItemsTable(doc, items, startY) {
  let currentY = startY;
  const tableTop = currentY;
  const tableHeaders = ['Material', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total'];
  
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
    
    if (currentY + rowHeight > doc.page.height - 150) {
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

function drawTotals(doc, oc) {
    let currentY = doc.y + 15;
    const rightAlignX = 490;
    const labelWidth = 80;
    
    doc.font('Helvetica');
    doc.text('Subtotal:', rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
    doc.text(`$${Number(oc.sub_total).toFixed(2)}`, rightAlignX, currentY, { width: 80, align: 'right' });
    currentY += 15;
    
    doc.text(`IVA (${(Number(oc.iva) / Number(oc.sub_total) * 100 || 16).toFixed(0)}%):`, rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
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
 * @description Orquesta la generación del PDF.
 * @param {object} ocData - El objeto COMPLETO con los datos de la cabecera de la OC.
 * @param {Array<object>} itemsData - Un ARREGLO con los materiales de la OC.
 * @returns {Promise<Buffer>} El Buffer del PDF generado.
 */
const generatePurchaseOrderPdf = async (ocData, itemsData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Dibuja el contenido usando los datos que recibe como parámetros.
      drawHeader(doc, ocData);
      let currentY = drawInfoSection(doc, ocData);
      currentY = drawItemsTable(doc, itemsData, currentY);
      drawTotals(doc, ocData);
      
      // Asegura que el pie de página se dibuje en todas las páginas.
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < (pages.count || 1); i++) {
        doc.switchToPage(i);
        drawFooter(doc);
      }

      doc.end();
    } catch (error) {
      console.error("Error durante la generación del stream del PDF:", error);
      reject(error);
    }
  });
};

module.exports = { generatePurchaseOrderPdf };