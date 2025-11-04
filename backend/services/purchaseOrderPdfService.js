//C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDFs para Órdenes de Compra (Versión 3.0 - Refactorizada)
 * =================================================================================================
 * @file purchaseOrderPdfService.js
 * @description Utiliza PDFKit para generar un PDF de OC.
 * - ¡CAMBIO! Ahora acepta un 'ocId' y consulta sus propios datos,
 * asegurando que la información sea correcta y completa.
 */

// --- Importaciones ---
const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../db/pool'); // Necesario para consultar la BD

// ===============================================================================================
// --- Funciones de Ayuda para Dibujar el PDF (Helpers) ---
// (Estas funciones no cambian, solo consumen los datos de la nueva consulta)
// ===============================================================================================

function drawHeader(doc, oc) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (require('fs').existsSync(logoPath)) {
    doc.image(logoPath, 40, 35, { width: 60 });
  }
  
  doc.fillColor('#002D62').fontSize(20).font('Helvetica-Bold').text('ORDEN DE COMPRA', 0, 50, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black');
  doc.text(`Número OC: ${oc.numero_oc}`, 400, 50, { align: 'right' });
  // Usa fecha_aprobacion si existe, si no, la fecha actual
  const fecha = oc.fecha_aprobacion ? new Date(oc.fecha_aprobacion) : new Date();
  doc.text(`Fecha de Aprobación: ${fecha.toLocaleDateString('es-MX')}`, 400, 65, { align: 'right' });
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
    const itemTotal = (Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2);
    const materialNombre = item.material_nombre || 'Material Desconocido'; // Usa el nombre de la consulta
    const rowHeight = doc.heightOfString(materialNombre, { width: 240 }) + 10;
    
    if (currentY + rowHeight > doc.page.height - 150) {
      doc.addPage();
      currentY = 40;
      // (Opcional: redibujar cabeceras de tabla en página nueva)
    }
    
    doc.text(materialNombre, 45, currentY, { width: 240 });
    doc.text(Number(item.cantidad).toFixed(2), 300, currentY, { width: 50, align: 'center' });
    doc.text(item.unidad_simbolo, 350, currentY, { width: 60, align: 'center' }); // Usa la unidad de la consulta
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
    
    // Calcular IVA rate dinámicamente
    const ivaRate = (oc.sub_total > 0) ? (Number(oc.iva) / Number(oc.sub_total)) * 100 : 0;

    doc.font('Helvetica');
    doc.text('Subtotal:', rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
    doc.text(`$${Number(oc.sub_total).toFixed(2)}`, rightAlignX, currentY, { width: 80, align: 'right' });
    currentY += 15;
    
    doc.text(`IVA (${ivaRate.toFixed(0)}%):`, rightAlignX - labelWidth, currentY, { width: labelWidth, align: 'right' });
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

// ===============================================================================================
// --- ¡FUNCIÓN PRINCIPAL REFACTORIZADA! ---
// ===============================================================================================

/**
 * @description Orquesta la generación del PDF.
 * ¡CAMBIO! Ahora acepta un 'ocId' y consulta sus propios datos.
 * @param {number} ocId - El ID de la Orden de Compra a generar.
 * @returns {Promise<Buffer>} El Buffer del PDF generado.
 */
const generatePurchaseOrderPdf = async (ocId) => {
  // 1) Traer datos completos para el PDF (cabecera)
  // (Lógica de consulta robusta tomada de ocAuthorizationService.js)
  const ocQ = await pool.query(`
    SELECT oc.*, 
           p.razon_social AS proveedor_razon_social, p.marca AS proveedor_marca, p.rfc AS proveedor_rfc, p.correo AS proveedor_correo,
           proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre AS usuario_nombre,
           (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
           NOW() AS fecha_aprobacion
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN proyectos proy ON oc.proyecto_id = proy.id
    JOIN sitios s ON oc.sitio_id = s.id
    JOIN usuarios u ON oc.usuario_id = u.id
    WHERE oc.id = $1
  `, [ocId]);

  if (ocQ.rowCount === 0) throw new Error(`[PDF Service] OC ${ocId} no encontrada.`);
  const ocData = ocQ.rows[0];

  // 2) Traer detalle (ítems)
  // (Lógica de consulta robusta tomada de ocAuthorizationService.js)
  const itemsQ = await pool.query(`
    SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo
    FROM ordenes_compra_detalle ocd
    JOIN catalogo_materiales cm ON ocd.material_id = cm.id
    JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
    WHERE ocd.orden_compra_id = $1
    ORDER BY ocd.id ASC
  `, [ocId]);
  const itemsData = itemsQ.rows;
  
  // 3) Generar el PDF en un Buffer
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Dibuja el contenido usando los datos que SÍ consultó
      drawHeader(doc, ocData);
      let currentY = drawInfoSection(doc, ocData);
      currentY = drawItemsTable(doc, itemsData, currentY);
      drawTotals(doc, ocData);
      
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