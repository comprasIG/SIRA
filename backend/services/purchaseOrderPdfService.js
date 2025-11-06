// C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDFs (Versión 4.0 - Corrección de Formato)
 * =================================================================================================
 * @file purchaseOrderPdfService.js
 * @description Genera un PDF de OC.
 * --- HISTORIAL DE CAMBIOS ---
 * v4.0: (Solicitado por usuario)
 * - Se cambia "Número OC:" por "Número:".
 * - Se cambia "Fecha de Aprobación:" por "Fecha de Creación:".
 * - Se mueven los totales 20px hacia arriba (de 670 a 650) para evitar
 * el salto de página del footer en OCs con pocos items.
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../db/pool');

// --- SECCIÓN DE DIBUJO (Con correcciones de formato) ---
function drawHeader(doc, oc) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (require('fs').existsSync(logoPath)) {
    doc.image(logoPath, 40, 35, { width: 60 });
  }
  doc.fillColor('#002D62').fontSize(20).font('Helvetica-Bold').text('ORDEN DE COMPRA', 0, 50, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black');
  
  const ocNumber = (oc.numero_oc && !oc.numero_oc.startsWith('OC-')) ? `OC-${oc.numero_oc}` : oc.numero_oc;

  // ==================================================================
  // --- ¡INICIO DE CORRECCIÓN DE FORMATO! ---
  // ==================================================================
  
  // 1. Cambiado "Número OC:" por "Número:"
  doc.text(`Número: ${ocNumber}`, { align: 'right' }); 
  
  // 2. Cambiado "Fecha de Aprobación:" por "Fecha de Creación:"
  // (La variable 'oc.fecha_aprobacion' ahora es un ALIAS de la fecha de creación en el controlador)
  doc.text(`Fecha de Creación: ${new Date(oc.fecha_aprobacion).toLocaleDateString('es-MX')}`, { align: 'right' });
  
  // ==================================================================
  // --- ¡FIN DE CORRECCIÓN DE FORMATO! ---
  // ==================================================================
  
  doc.moveDown(0.5);
}

function drawInfoSection(doc, oc) {
  doc.fontSize(12).font('Helvetica-Bold').text('Proveedor:', 40, 110);
  doc.font('Helvetica').fontSize(10);
  doc.text(oc.proveedor_razon_social || oc.proveedor_marca || 'N/D', 40, 125);
  doc.text(oc.proveedor_rfc || 'N/D');

  doc.fontSize(12).font('Helvetica-Bold').text('Información de Entrega:', 300, 110);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Sitio: ${oc.sitio_nombre || 'N/D'}`, 300, 125);
  doc.text(`Proyecto: ${oc.proyecto_nombre || 'N/D'}`);
  doc.text(`Generado por: ${oc.usuario_nombre || 'N/D'}`);

  doc.moveDown(2);
  const startY = doc.y;
  doc.lineCap('butt').moveTo(40, startY).lineTo(572, startY).stroke();
  return startY + 10;
}

function drawItemsTable(doc, items, startY) {
  let currentY = startY;
  
  // Cabecera de la tabla
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Material', 40, currentY, { width: 260 });
  doc.text('Cantidad', 300, currentY, { width: 60, align: 'right' });
  doc.text('Unidad', 370, currentY, { width: 60, align: 'center' });
  doc.text('Precio Unit.', 430, currentY, { width: 70, align: 'right' });
  doc.text('Total', 500, currentY, { width: 70, align: 'right' });
  doc.moveDown(0.5);
  currentY = doc.y;
  doc.lineCap('butt').moveTo(40, currentY).lineTo(572, currentY).stroke();
  currentY += 10;
  
  // Filas de la tabla
  doc.fontSize(9).font('Helvetica');
  items.forEach(item => {
    const materialHeight = doc.heightOfString(item.material_nombre, { width: 260 });
    const rowHeight = materialHeight + 8;

    if (currentY + rowHeight > 700) { // <-- Límite para el salto de página
      doc.addPage();
      currentY = 40;
    }

    doc.text(item.material_nombre, 40, currentY, { width: 260 });
    doc.text(Number(item.cantidad).toFixed(2), 300, currentY, { width: 60, align: 'right' });
    doc.text(item.unidad_simbolo || 'N/A', 370, currentY, { width: 60, align: 'center' });
    doc.text(`$${Number(item.precio_unitario).toFixed(2)}`, 430, currentY, { width: 70, align: 'right' });
    doc.text(`$${(Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
    
    currentY += rowHeight;
    doc.lineCap('butt').moveTo(40, currentY - 4).lineTo(572, currentY - 4).dash(1, { space: 2 }).stroke();
  });

  return currentY; // Devuelve la posición Y donde terminó la tabla
}

function drawTotals(doc, oc) {
  
  // ==================================================================
  // --- ¡INICIO DE CORRECCIÓN DE FORMATO (Paginación)! ---
  // ==================================================================
  
  // 3. Se mueven los totales 20px hacia arriba para evitar el salto de página
  let currentY = 650; // <-- Antes era 670
  
  // ==================================================================
  // --- ¡FIN DE CORRECCIÓN DE FORMATO! ---
  // ==================================================================

  const currency = oc.moneda || 'MXN';
  const subTotal = Number(oc.sub_total || 0);
  const iva = Number(oc.iva || 0);
  const total = Number(oc.total || 0);
  
  doc.font('Helvetica-Bold').fontSize(10);
  
  doc.text('Subtotal:', 430, currentY, { width: 70, align: 'right' });
  doc.text(`$${subTotal.toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
  currentY += 15;
  
  doc.text('IVA (16%):', 430, currentY, { width: 70, align: 'right' });
  doc.text(`$${iva.toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
  currentY += 15;
  
  doc.text('Total:', 430, currentY, { width: 70, align: 'right' });
  doc.text(`$${total.toFixed(2)} ${currency}`, 500, currentY, { width: 70, align: 'right' });
}

// =================================================================================================
// --- FUNCIÓN PRINCIPAL (Versión 4.0) ---
// =================================================================================================
/**
 * @param {object} ocData - La fila completa de 'ordenes_compra' (con joins).
 * @param {array} itemsData - Un array de filas de 'ordenes_compra_detalle' (con joins).
 * @param {object} [db=pool] - (Opcional) Un cliente de transacción de node-pg.
 */
async function generatePurchaseOrderPdf(ocData, itemsData, db = pool) {
  
  // (RF) Ya no necesitamos la consulta redundante de 'itemsData',
  // porque los controladores 'vistoBueno' y 'ordenCompra' (corregidos)
  // ahora los consultan y los pasan como 'itemsData'.

  // 3) Generar el PDF en un Buffer
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      drawHeader(doc, ocData);
      let currentY = drawInfoSection(doc, ocData);
      
      // (RF) 'itemsData' es el array que viene del controlador
      currentY = drawItemsTable(doc, itemsData, currentY); 
      
      // (RF) No le pasamos 'currentY' a drawTotals, ya que movimos
      // los totales fijos hacia arriba (Línea 106).
      drawTotals(doc, ocData); 
      
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#AAAAAA')
           .text('Este documento es una Orden de Compra oficial. Sujeto a términos y condiciones.', 40, 720, { align: 'left' })
           .text(`Documento generado por SIRA - Sistema Integral de Requisiciones y Abastecimiento`, 40, 730, { align: 'left' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePurchaseOrderPdf
};