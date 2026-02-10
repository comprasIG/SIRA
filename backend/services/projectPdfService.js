// C:\SIRA\backend\services\projectPdfService.js
/**
 * PDF de "nuevo proyecto para autorizacion"
 * Estilo visual alineado al layout de OC (background, header corporativo y footer).
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PAGE_SIZE = 'LETTER';
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const CONTENT_BOTTOM = 690;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BG_PATH = path.join(ASSETS_DIR, 'DOCS_background_grupoIG.jpg');

function safeText(value, fallback = 'N/D') {
  const str = String(value ?? '').trim();
  return str.length ? str : fallback;
}

function formatProjectCode(projectId, pad = 4) {
  const num = Number(projectId);
  if (!Number.isInteger(num) || num <= 0) return 'PROY-S/N';
  return `PROY-${String(num).padStart(pad, '0')}`;
}

function formatDate(value) {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return date.toLocaleDateString('es-MX');
}

function formatNumber4(value) {
  if (value === null || value === undefined || value === '') return 'N/D';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/D';
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatMoney(value, moneda) {
  const num = formatNumber4(value);
  if (num === 'N/D') return 'N/D';
  const code = String(moneda ?? '').trim().toUpperCase();
  return code ? `${num} ${code}` : num;
}

function isoDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function resolveMilestoneStatus(hito) {
  if (hito?.fecha_realizacion) return 'REALIZADO';
  const target = isoDateOnly(hito?.target_date);
  if (!target) return 'PENDIENTE';
  const today = new Date().toISOString().slice(0, 10);
  return target < today ? 'VENCIDO' : 'PENDIENTE';
}

function drawBackground(doc) {
  if (!fs.existsSync(BG_PATH)) return;
  doc.save();
  doc.image(BG_PATH, 0, 0, { width: doc.page.width, height: doc.page.height });
  doc.restore();
}

function drawFooter(doc) {
  doc.save();
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor('#666666')
    .text(
      'Documento generado por SIRA - Agente virtual de IA en Grupo IG.',
      MARGIN_LEFT,
      PAGE_HEIGHT - 96,
      { width: CONTENT_WIDTH, align: 'left' }
    )
    .text(
      'Este PDF se genera para flujo de autorizacion de proyectos.',
      MARGIN_LEFT,
      PAGE_HEIGHT - 84,
      { width: CONTENT_WIDTH, align: 'left' }
    );
  doc.restore();
}

function drawHeader(doc, payload, isContinuation = false) {
  const projectCode = formatProjectCode(payload?.proyecto?.id);
  const generatedAt = payload?.generatedAt || new Date();

  doc.save();
  doc.fillColor('#123A6F').font('Helvetica-Bold').fontSize(17);
  doc.text(
    isContinuation
      ? `NUEVO PROYECTO - AUTORIZACION (CONT.)`
      : `NUEVO PROYECTO - SOLICITUD DE AUTORIZACION`,
    MARGIN_LEFT,
    54,
    { width: CONTENT_WIDTH, align: 'center' }
  );

  const rightX = PAGE_WIDTH - MARGIN_RIGHT - 220;
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text(`Codigo: ${projectCode}`, rightX, 58, { width: 220, align: 'right' });
  doc.text(`Fecha: ${formatDate(generatedAt)}`, rightX, 72, { width: 220, align: 'right' });

  const sepY = 98;
  doc.lineWidth(1).strokeColor('#333333');
  doc.moveTo(MARGIN_LEFT, sepY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, sepY).stroke();
  doc.restore();

  return 112;
}

function ensureSpace(doc, currentY, requiredHeight, payload) {
  if (currentY + requiredHeight <= CONTENT_BOTTOM) return currentY;
  doc.addPage();
  drawBackground(doc);
  return drawHeader(doc, payload, true);
}

function drawSectionTitle(doc, title, y) {
  doc.save();
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 22, 5).fill('#E9F1FB');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#123A6F');
  doc.text(title, MARGIN_LEFT + 10, y + 7, { width: CONTENT_WIDTH - 20 });
  doc.restore();
  return y + 30;
}

function drawInfoRow(doc, y, leftLabel, leftValue, rightLabel, rightValue) {
  const colGap = 16;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const rightX = MARGIN_LEFT + colWidth + colGap;

  doc.save();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
  doc.text(`${leftLabel}:`, MARGIN_LEFT, y, { width: 92 });
  doc.font('Helvetica').text(safeText(leftValue), MARGIN_LEFT + 94, y, { width: colWidth - 94 });

  doc.font('Helvetica-Bold').text(`${rightLabel}:`, rightX, y, { width: 92 });
  doc.font('Helvetica').text(safeText(rightValue), rightX + 94, y, { width: colWidth - 94 });
  doc.restore();

  return y + 15;
}

function drawGeneralSection(doc, payload, startY) {
  let y = ensureSpace(doc, startY, 180, payload);
  y = drawSectionTitle(doc, 'Datos Generales', y);

  const proyecto = payload.proyecto || {};
  const actor = payload.generadoPor || {};

  y = drawInfoRow(doc, y, 'Proyecto', proyecto.nombre, 'Estado', proyecto.status);
  y = drawInfoRow(doc, y, 'Sitio', proyecto.sitio_nombre, 'Cliente', proyecto.cliente_nombre);
  y = drawInfoRow(doc, y, 'Responsable', proyecto.responsable_nombre, 'Correo resp.', proyecto.responsable_correo);
  y = drawInfoRow(doc, y, 'Generado por', actor.nombre, 'Correo usuario', actor.correo);
  y = drawInfoRow(doc, y, 'Codigo interno', formatProjectCode(proyecto.id), 'Fecha generacion', formatDate(payload.generatedAt));

  y += 6;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
  doc.text('Descripcion:', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
  doc.font('Helvetica').fontSize(9);
  const description = safeText(proyecto.descripcion, 'Sin descripcion');
  const descY = y + 12;
  const descHeight = doc.heightOfString(description, { width: CONTENT_WIDTH });
  doc.text(description, MARGIN_LEFT, descY, { width: CONTENT_WIDTH });
  doc.restore();

  return descY + descHeight + 12;
}

function drawPlanningSection(doc, payload, startY) {
  let y = ensureSpace(doc, startY, 76, payload);
  y = drawSectionTitle(doc, 'Planificacion', y);
  y = drawInfoRow(
    doc,
    y,
    'Inicio',
    formatDate(payload?.proyecto?.fecha_inicio),
    'Cierre',
    formatDate(payload?.proyecto?.fecha_cierre)
  );
  return y + 6;
}

function drawFinanceSection(doc, payload, startY) {
  let y = ensureSpace(doc, startY, 96, payload);
  y = drawSectionTitle(doc, 'Finanzas', y);

  const proyecto = payload?.proyecto || {};
  y = drawInfoRow(
    doc,
    y,
    'Total facturado',
    formatMoney(proyecto.total_facturado, proyecto.total_facturado_moneda),
    'Costo total',
    formatMoney(proyecto.costo_total, proyecto.costo_total_moneda)
  );
  y = drawInfoRow(
    doc,
    y,
    'Margen estimado',
    formatMoney(proyecto.margen_estimado, proyecto.margen_moneda),
    'Margen forzado',
    proyecto.margen_es_forzado === true ? 'SI' : 'NO'
  );
  return y + 8;
}

function drawMilestoneTableHeader(doc, y) {
  const cols = {
    idx: { x: MARGIN_LEFT, w: 24 },
    nombre: { x: MARGIN_LEFT + 24, w: 170 },
    descripcion: { x: MARGIN_LEFT + 194, w: 150 },
    target: { x: MARGIN_LEFT + 344, w: 56 },
    realizada: { x: MARGIN_LEFT + 400, w: 56 },
    estado: { x: MARGIN_LEFT + 456, w: 56 },
  };

  doc.save();
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 18).fill('#F2F5F8');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#123A6F');
  doc.text('#', cols.idx.x + 2, y + 5, { width: cols.idx.w - 4, align: 'left' });
  doc.text('Hito', cols.nombre.x + 2, y + 5, { width: cols.nombre.w - 4 });
  doc.text('Descripcion', cols.descripcion.x + 2, y + 5, { width: cols.descripcion.w - 4 });
  doc.text('Target', cols.target.x + 2, y + 5, { width: cols.target.w - 4, align: 'center' });
  doc.text('Realizada', cols.realizada.x + 2, y + 5, { width: cols.realizada.w - 4, align: 'center' });
  doc.text('Estado', cols.estado.x + 2, y + 5, { width: cols.estado.w - 4, align: 'center' });
  doc.restore();

  return { nextY: y + 20, cols };
}

function drawMilestonesSection(doc, payload, startY) {
  let y = ensureSpace(doc, startY, 110, payload);
  y = drawSectionTitle(doc, 'Hitos', y);

  const hitos = Array.isArray(payload?.hitos) ? payload.hitos : [];
  if (hitos.length === 0) {
    doc.save();
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text('No hay hitos registrados para este proyecto.', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    doc.restore();
    return y + 18;
  }

  let table = drawMilestoneTableHeader(doc, y);
  y = table.nextY;
  const cols = table.cols;

  for (let i = 0; i < hitos.length; i += 1) {
    const h = hitos[i];
    const nombre = safeText(h?.nombre, '-');
    const descripcion = safeText(h?.descripcion, '-');
    const target = formatDate(h?.target_date);
    const realizada = formatDate(h?.fecha_realizacion);
    const estado = resolveMilestoneStatus(h);

    const nombreH = doc.heightOfString(nombre, { width: cols.nombre.w - 4 });
    const descripcionH = doc.heightOfString(descripcion, { width: cols.descripcion.w - 4 });
    const rowHeight = Math.max(18, Math.max(nombreH, descripcionH) + 6);

    if (y + rowHeight > CONTENT_BOTTOM) {
      doc.addPage();
      drawBackground(doc);
      y = drawHeader(doc, payload, true);
      y = drawSectionTitle(doc, 'Hitos (continuacion)', y);
      table = drawMilestoneTableHeader(doc, y);
      y = table.nextY;
    }

    doc.save();
    if (i % 2 === 0) {
      doc.rect(MARGIN_LEFT, y - 1, CONTENT_WIDTH, rowHeight).fill('#FBFCFD');
    }

    doc.font('Helvetica').fontSize(8).fillColor('#111111');
    doc.text(String(i + 1), cols.idx.x + 2, y + 2, { width: cols.idx.w - 4 });
    doc.text(nombre, cols.nombre.x + 2, y + 2, { width: cols.nombre.w - 4 });
    doc.text(descripcion, cols.descripcion.x + 2, y + 2, { width: cols.descripcion.w - 4 });
    doc.text(target, cols.target.x + 2, y + 2, { width: cols.target.w - 4, align: 'center' });
    doc.text(realizada, cols.realizada.x + 2, y + 2, { width: cols.realizada.w - 4, align: 'center' });

    const estadoColor =
      estado === 'REALIZADO' ? '#1F7A3B' : estado === 'VENCIDO' ? '#B42318' : '#8A6A00';
    doc.fillColor(estadoColor).font('Helvetica-Bold');
    doc.text(estado, cols.estado.x + 2, y + 2, { width: cols.estado.w - 4, align: 'center' });
    doc.restore();

    y += rowHeight;
  }

  return y + 4;
}

async function generateProjectAuthorizationPdf({
  proyecto,
  hitos = [],
  generadoPor = {},
  generatedAt = new Date(),
} = {}) {
  if (!proyecto) {
    throw new Error('No se pudo generar el PDF: datos de proyecto incompletos.');
  }

  const payload = { proyecto, hitos, generadoPor, generatedAt };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: PAGE_SIZE, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      drawBackground(doc);
      let y = drawHeader(doc, payload, false);
      y = drawGeneralSection(doc, payload, y);
      y = drawPlanningSection(doc, payload, y);
      y = drawFinanceSection(doc, payload, y);
      drawMilestonesSection(doc, payload, y);

      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i += 1) {
        doc.switchToPage(i);
        drawFooter(doc);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateProjectAuthorizationPdf,
};

