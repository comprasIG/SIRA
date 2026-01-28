// C:\SIRA\backend\services\purchaseOrderPdfService.js
/**
 * =================================================================================================
 * SERVICIO: Generación de PDF - Orden de Compra (OC)
 * =================================================================================================
 * Ajustes solicitados (v4):
 * - Eliminar columna "Plazo" (no necesaria) para ganar espacio
 * - Aumentar ancho de SKU (mejor para SKUs largos)
 * - Separar más "P. Unit." y "Total" y evitar que "Total" se parta en dos líneas
 * - Background sin transparencia (opacidad original)
 * - Proveedor en 1 línea + más abajo para no pelear con logo
 * - Generado por en 2 renglones (nombre y correo)
 * - Sitio + Proyecto en 1 renglón
 * - Footer actualizado (facturación + firma SIRA)
 *
 * Nota:
 * - Este PDF soporta oc.lugar_entrega_nombre (para mostrar nombre en vez del ID).
 *   Ahorita te llega "2" porque aún no estamos resolviendo el nombre en el query. :contentReference[oaicite:1]{index=1}
 * =================================================================================================
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');

const PAGE_SIZE = 'LETTER';
const PAGE_WIDTH = 612;

const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;

const SAFE_TOP_Y = 55;
const TOTALS_BOX_TOP_Y = 575;
const FOOTER_TEXT_Y_1 = 675;
const FOOTER_TEXT_Y_2 = 686;

const OC_PAD_DIGITS = 4;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BG_PATH = path.join(ASSETS_DIR, 'DOCS_background_grupoIG.jpg');

/* ================================================================================================
 * Helpers
 * ==============================================================================================*/

function formatOcForDisplay(numeroOcRaw, padDigits = OC_PAD_DIGITS) {
  const raw = String(numeroOcRaw ?? '').trim();
  const match = raw.match(/(\d+)/);
  if (!match) return raw || 'OC-S/N';

  const digits = match[1];
  const padded = digits.length >= padDigits ? digits : digits.padStart(padDigits, '0');
  return `OC-${padded}`;
}

function safeText(v, fallback = 'N/D') {
  const s = String(v ?? '').trim();
  return s.length > 0 ? s : fallback;
}

function getProveedorNombre(oc) {
  const marca = String(oc?.proveedor_marca ?? '').trim();
  if (marca) return marca;
  const razon = String(oc?.proveedor_razon_social ?? '').trim();
  return razon || 'PROVEEDOR';
}

function toMoney(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toFixed(2)}`;
}

function getOcFecha(oc) {
  const v = oc?.fecha_aprobacion || oc?.fecha_creacion || new Date();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/* ================================================================================================
 * Background / Footer
 * ==============================================================================================*/

function drawBackground(doc) {
  if (!fs.existsSync(BG_PATH)) return;

  // SIN transparencia
  doc.save();
  doc.image(BG_PATH, 0, 0, { width: doc.page.width, height: doc.page.height });
  doc.restore();
}

function drawFooter(doc) {
  doc.save();
  doc.font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor('#666666')
    .text(
      'Enviar su factura referenciada con este num. de OC a lauraochoa@igbiogas.com',
      MARGIN_LEFT,
      FOOTER_TEXT_Y_1,
      { width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT, align: 'left' }
    )
    .text(
      'Documento generado por SIRA - Agente virtual de IA en grupo IG.',
      MARGIN_LEFT,
      FOOTER_TEXT_Y_2,
      { width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT, align: 'left' }
    );
  doc.restore();
}

/* ================================================================================================
 * Header
 * ==============================================================================================*/

function drawHeader(doc, oc) {
  const ocDisplay = formatOcForDisplay(oc?.numero_oc);

  doc.save();

  // Azul navy más “azul”
  doc.fillColor('#123A6F').font('Helvetica-Bold').fontSize(18);
  doc.text('ORDEN DE COMPRA', MARGIN_LEFT, SAFE_TOP_Y, {
    width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT,
    align: 'center',
  });

  // Datos derecha
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  const rightX = PAGE_WIDTH - MARGIN_RIGHT - 220;
  const topY = SAFE_TOP_Y + 5;

  doc.text(`Número: ${ocDisplay}`, rightX, topY, { width: 220, align: 'right' });
  doc.text(`Fecha: ${getOcFecha(oc).toLocaleDateString('es-MX')}`, rightX, topY + 14, { width: 220, align: 'right' });

  // Badge urgente (solo visual)
  if (oc?.es_urgente === true) {
    const badgeW = 90;
    const badgeH = 18;
    const badgeX = PAGE_WIDTH - MARGIN_RIGHT - badgeW;
    const badgeY = SAFE_TOP_Y + 28;

    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fill('#C62828');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
    doc.text('URGENTE', badgeX, badgeY + 4, { width: badgeW, align: 'center' });
  }

  doc.restore();
}

/* ================================================================================================
 * Info Section
 * ==============================================================================================*/

function drawInfoSection(doc, oc) {
  const startY = SAFE_TOP_Y + 55;

  // Bajamos un poco para no pelear con logo
  const leftX = MARGIN_LEFT;
  const leftY = startY + 6;

  const rightX = 300;

  const proveedorNombre = getProveedorNombre(oc);
  const rfqCode = String(oc?.rfq_code ?? '').trim();
  const sitio = safeText(oc?.sitio_nombre);
  const proyecto = String(oc?.proyecto_nombre ?? '').trim();

  const usuarioNombre = safeText(oc?.usuario_nombre);
  const usuarioCorreo = String(oc?.usuario_correo ?? '').trim();

  // Lugar entrega: usar nombre si existe
  const lugarEntregaNombre = String(oc?.lugar_entrega_nombre ?? '').trim();
  const lugarEntregaRaw = String(oc?.lugar_entrega ?? '').trim();
  const lugarEntrega = lugarEntregaNombre || lugarEntregaRaw;

  doc.save();

  // Proveedor en 1 línea
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
  doc.text('Proveedor: ', leftX, leftY, { continued: true });
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text(proveedorNombre);

  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text(`RFC: ${safeText(oc?.proveedor_rfc)}`, leftX, leftY + 18, { width: 260 });

  // Derecha
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
  doc.text('Entrega', rightX, startY);

  doc.font('Helvetica').fontSize(10).fillColor('#111111');

  const sitioProyecto = proyecto ? `${sitio} - ${proyecto}` : sitio;
  doc.text(`Sitio: ${sitioProyecto}`, rightX, startY + 14, { width: 260 });

  if (rfqCode) doc.text(`RFQ: ${rfqCode}`, rightX, startY + 28, { width: 260 });

  // Generado por (2 renglones fijos)
  doc.text(`Generado por: ${usuarioNombre}`, rightX, startY + 42, { width: 260 });
  if (usuarioCorreo) doc.text(`Correo: ${usuarioCorreo}`, rightX, startY + 56, { width: 260 });

  // Lugar de entrega
  if (lugarEntrega) doc.text(`Lugar de entrega: ${lugarEntrega}`, rightX, startY + 70, { width: 260 });

  // Línea separadora
  const lineY = startY + 98;
  doc.lineWidth(1).strokeColor('#333333');
  doc.moveTo(MARGIN_LEFT, lineY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, lineY).stroke();

  doc.restore();
  return lineY + 12;
}

/* ================================================================================================
 * Items Table (SIN PLAZO)
 * ==============================================================================================*/

function getTableColumns() {
  const x0 = MARGIN_LEFT;

  // Quitamos "Plazo" y reconocemos más ancho a SKU + separación P.Unit/Total
  return {
    sku: { x: x0, w: 70 },                    // + ancho para SKUs largos
    material: { x: x0 + 70, w: 215 },
    cantidad: { x: x0 + 285, w: 55 },
    unidad: { x: x0 + 340, w: 40 },
    precio: { x: x0 + 380, w: 80 },           // más ancho
    // dejamos “aire” antes de total
    total: { x: x0 + 470, w: (PAGE_WIDTH - MARGIN_RIGHT) - (x0 + 470) },
  };
}

function drawItemsTableHeader(doc, y) {
  const cols = getTableColumns();

  doc.save();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');

  doc.text('SKU', cols.sku.x, y, { width: cols.sku.w });
  doc.text('Material', cols.material.x, y, { width: cols.material.w });
  doc.text('Cant.', cols.cantidad.x, y, { width: cols.cantidad.w, align: 'right' });
  doc.text('Und.', cols.unidad.x, y, { width: cols.unidad.w, align: 'center' });
  doc.text('P. Unit.', cols.precio.x, y, { width: cols.precio.w, align: 'right' });
  doc.text('Total', cols.total.x, y, { width: cols.total.w, align: 'right' });

  const sepY = y + 12;
  doc.lineWidth(1).strokeColor('#333333');
  doc.moveTo(MARGIN_LEFT, sepY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, sepY).stroke();

  doc.restore();
  return sepY + 8;
}

function drawItemsTable(doc, oc, items, startY) {
  let y = startY;
  y = drawItemsTableHeader(doc, y);

  const cols = getTableColumns();

  doc.save();
  doc.font('Helvetica').fontSize(9).fillColor('#111111');

  for (const it of items) {
    const material = safeText(it?.material_nombre, 'N/D');
    const sku = safeText(it?.sku, 'N/A');
    const cantidad = Number(it?.cantidad ?? 0);
    const precioUnit = Number(it?.precio_unitario ?? 0);
    const totalLinea = cantidad * precioUnit;

    const unidad = safeText(it?.unidad_simbolo, 'N/A');

    const materialH = doc.heightOfString(material, { width: cols.material.w });
    const rowH = Math.max(16, materialH + 6);

    if (y + rowH > TOTALS_BOX_TOP_Y - 10) {
      doc.restore();
      doc.addPage();
      drawBackground(doc);
      drawHeader(doc, oc);

      y = SAFE_TOP_Y + 75;
      doc.save();
      doc.font('Helvetica').fontSize(9).fillColor('#111111');
      doc.text(
        `Proveedor: ${getProveedorNombre(oc)}   |   Sitio: ${safeText(oc?.sitio_nombre)}   |   Proyecto: ${safeText(oc?.proyecto_nombre)}`,
        MARGIN_LEFT,
        y,
        { width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT }
      );
      doc.restore();

      y += 16;
      y = drawItemsTableHeader(doc, y);
      doc.save();
      doc.font('Helvetica').fontSize(9).fillColor('#111111');
    }

    doc.text(sku, cols.sku.x, y, { width: cols.sku.w });
    doc.text(material, cols.material.x, y, { width: cols.material.w });
    doc.text(cantidad.toFixed(2), cols.cantidad.x, y, { width: cols.cantidad.w, align: 'right' });
    doc.text(unidad, cols.unidad.x, y, { width: cols.unidad.w, align: 'center' });
    doc.text(toMoney(precioUnit), cols.precio.x, y, { width: cols.precio.w, align: 'right' });
    doc.text(toMoney(totalLinea), cols.total.x, y, { width: cols.total.w, align: 'right' });

    const dashY = y + rowH - 2;
    doc.save();
    doc.strokeColor('#999999').dash(1, { space: 2 });
    doc.moveTo(MARGIN_LEFT, dashY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, dashY).stroke();
    doc.undash();
    doc.restore();

    y += rowH;
  }

  doc.restore();
  return y;
}

/* ================================================================================================
 * Finanzas + Firma + Totales
 * ==============================================================================================*/

function drawFinanceNotes(doc, oc) {
  const notes = String(oc?.comentarios_finanzas ?? '').trim();
  if (!notes) return;

  const neededH = Math.min(
    110,
    doc.heightOfString(notes, { width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 20 }) + 30
  );

  if (doc.y + neededH > TOTALS_BOX_TOP_Y - 12) {
    doc.addPage();
    drawBackground(doc);
    drawHeader(doc, oc);
    doc.y = SAFE_TOP_Y + 85;
  }

  const boxX = MARGIN_LEFT;
  const boxW = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const boxY = doc.y + 6;
  const boxH = Math.max(50, neededH);

  doc.save();
  doc.roundedRect(boxX, boxY, boxW, boxH, 6).strokeColor('#444444').lineWidth(1).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111');
  doc.text('Notas de finanzas', boxX + 10, boxY + 8);

  doc.font('Helvetica').fontSize(9).fillColor('#111111');
  doc.text(notes, boxX + 10, boxY + 24, { width: boxW - 20 });

  doc.restore();
  doc.y = boxY + boxH + 6;
}

function drawSignature(doc) {
  const x = MARGIN_LEFT;
  const y = TOTALS_BOX_TOP_Y + 10;

  doc.save();
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text('CFO - Lic. Juan Mario Galán', x, y, { width: 260 });

  doc.strokeColor('#111111').lineWidth(1);
  doc.moveTo(x, y + 26).lineTo(x + 260, y + 26).stroke();

  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555555');
  doc.text('Firma', x, y + 30, { width: 260 });

  doc.restore();
}

function drawTotals(doc, oc) {
  const currency = safeText(oc?.moneda, 'MXN');
  const subTotal = Number(oc?.sub_total ?? 0);
  const iva = Number(oc?.iva ?? 0);
  const retIsr = Number(oc?.ret_isr ?? 0);
  const total = Number(oc?.total ?? 0);

  const ivaRate = Number(oc?.iva_rate ?? 0);
  const isrRate = Number(oc?.isr_rate ?? 0);

  const boxW = 250;
  const x = PAGE_WIDTH - MARGIN_RIGHT - boxW;
  let y = TOTALS_BOX_TOP_Y + 5;

  doc.save();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111');

  doc.text('Subtotal:', x, y, { width: 130, align: 'right' });
  doc.text(toMoney(subTotal), x + 130, y, { width: 120, align: 'right' });
  y += 16;

  if (iva > 0.00005) {
    const pct = ivaRate > 0 ? ` (${Math.round(ivaRate * 100)}%)` : '';
    doc.text(`IVA${pct}:`, x, y, { width: 130, align: 'right' });
    doc.text(toMoney(iva), x + 130, y, { width: 120, align: 'right' });
    y += 16;
  }

  if (retIsr > 0.00005) {
    const pct = isrRate > 0 ? ` (${Math.round(isrRate * 10000) / 100}%)` : '';
    doc.text(`Ret. ISR${pct}:`, x, y, { width: 130, align: 'right' });
    doc.text(`-${toMoney(retIsr)}`, x + 130, y, { width: 120, align: 'right' });
    y += 16;
  }

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Total:', x, y + 4, { width: 130, align: 'right' });
  doc.text(`${toMoney(total)} ${currency}`, x + 130, y + 4, { width: 120, align: 'right' });

  doc.restore();
}

/* ================================================================================================
 * API pública
 * ==============================================================================================*/

async function generatePurchaseOrderPdf(ocData, itemsData, db = pool) {
  void db;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: PAGE_SIZE });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      drawBackground(doc);
      doc.on('pageAdded', () => drawBackground(doc));

      drawHeader(doc, ocData);
      const tableStartY = drawInfoSection(doc, ocData);

      const endY = drawItemsTable(doc, ocData, itemsData || [], tableStartY);
      doc.y = Math.min(endY + 6, TOTALS_BOX_TOP_Y - 10);

      drawFinanceNotes(doc, ocData);
      drawSignature(doc);
      drawTotals(doc, ocData);

      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        drawFooter(doc);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePurchaseOrderPdf,
};
