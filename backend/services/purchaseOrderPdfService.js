// C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDFs
 * Fix PRO:
 * - Totales condicionales: si IVA=0 no mostrar línea de IVA; si ISR=0 no mostrar ISR
 * - IVA ya no se imprime fijo "16%": usa oc.iva_rate cuando exista
 * - Mantiene layout/paginación
 * =================================================================================================
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../db/pool');

function drawHeader(doc, oc) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (require('fs').existsSync(logoPath)) {
    doc.image(logoPath, 40, 35, { width: 60 });
  }
  doc.fillColor('#002D62').fontSize(20).font('Helvetica-Bold').text('ORDEN DE COMPRA', 0, 50, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black');

  const ocNumber = (oc.numero_oc && !String(oc.numero_oc).startsWith('OC-')) ? `OC-${oc.numero_oc}` : oc.numero_oc;

  doc.text(`Número: ${ocNumber}`, { align: 'right' });
  doc.text(`Fecha de Creación: ${new Date(oc.fecha_aprobacion).toLocaleDateString('es-MX')}`, { align: 'right' });
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
  const columnPositions = {
    sku: { x: 40, width: 70 },
    material: { x: 110, width: 200 },
    cantidad: { x: 310, width: 60 },
    unidad: { x: 370, width: 50 },
    precio: { x: 420, width: 70 },
    total: { x: 490, width: 82 },
  };

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('SKU', columnPositions.sku.x, currentY, { width: columnPositions.sku.width });
  doc.text('Material', columnPositions.material.x, currentY, { width: columnPositions.material.width });
  doc.text('Cantidad', columnPositions.cantidad.x, currentY, { width: columnPositions.cantidad.width, align: 'right' });
  doc.text('Unidad', columnPositions.unidad.x, currentY, { width: columnPositions.unidad.width, align: 'center' });
  doc.text('Precio Unit.', columnPositions.precio.x, currentY, { width: columnPositions.precio.width, align: 'right' });
  doc.text('Total', columnPositions.total.x, currentY, { width: columnPositions.total.width, align: 'right' });
  doc.moveDown(0.5);

  currentY = doc.y;
  doc.lineCap('butt').moveTo(40, currentY).lineTo(572, currentY).stroke();
  currentY += 10;

  doc.fontSize(9).font('Helvetica');
  items.forEach(item => {
    const materialHeight = doc.heightOfString(item.material_nombre, { width: columnPositions.material.width });
    const rowHeight = materialHeight + 8;

    if (currentY + rowHeight > 700) {
      doc.addPage();
      currentY = 40;
    }

    doc.text(item.sku || 'N/A', columnPositions.sku.x, currentY, { width: columnPositions.sku.width });
    doc.text(item.material_nombre, columnPositions.material.x, currentY, { width: columnPositions.material.width });
    doc.text(Number(item.cantidad).toFixed(2), columnPositions.cantidad.x, currentY, { width: columnPositions.cantidad.width, align: 'right' });
    doc.text(item.unidad_simbolo || 'N/A', columnPositions.unidad.x, currentY, { width: columnPositions.unidad.width, align: 'center' });
    doc.text(`$${Number(item.precio_unitario).toFixed(2)}`, columnPositions.precio.x, currentY, { width: columnPositions.precio.width, align: 'right' });
    doc.text(`$${(Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2)}`, columnPositions.total.x, currentY, { width: columnPositions.total.width, align: 'right' });

    currentY += rowHeight;
    doc.lineCap('butt').moveTo(40, currentY - 4).lineTo(572, currentY - 4).dash(1, { space: 2 }).stroke();
  });

  return currentY;
}

function drawTotals(doc, oc) {
  let currentY = 650;

  const currency = oc.moneda || 'MXN';
  const subTotal = Number(oc.sub_total || 0);
  const iva = Number(oc.iva || 0);
  const retIsr = Number(oc.ret_isr || 0);
  const total = Number(oc.total || 0);

  const ivaRate = Number(oc.iva_rate || 0);
  const isrRate = Number(oc.isr_rate || 0);

  doc.font('Helvetica-Bold').fontSize(10);

  // Subtotal
  doc.text('Subtotal:', 430, currentY, { width: 70, align: 'right' });
  doc.text(`$${subTotal.toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
  currentY += 15;

  // IVA (solo si > 0)
  if (iva > 0.00005) {
    const pct = ivaRate > 0 ? ` (${Math.round(ivaRate * 100)}%)` : '';
    doc.text(`IVA${pct}:`, 430, currentY, { width: 70, align: 'right' });
    doc.text(`$${iva.toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
    currentY += 15;
  }

  // ISR (solo si > 0)
  if (retIsr > 0.00005) {
    const pct = isrRate > 0 ? ` (${Math.round(isrRate * 10000) / 100}%)` : '';
    doc.text(`Ret. ISR${pct}:`, 430, currentY, { width: 70, align: 'right' });
    doc.text(`-$${retIsr.toFixed(2)}`, 500, currentY, { width: 70, align: 'right' });
    currentY += 15;
  }

  // Total
  doc.text('Total:', 430, currentY, { width: 70, align: 'right' });
  doc.text(`$${total.toFixed(2)} ${currency}`, 500, currentY, { width: 70, align: 'right' });
}

async function generatePurchaseOrderPdf(ocData, itemsData, db = pool) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      drawHeader(doc, ocData);
      let currentY = drawInfoSection(doc, ocData);
      currentY = drawItemsTable(doc, itemsData, currentY);
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
