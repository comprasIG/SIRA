// C:\SIRA\backend\services\requisitionPdfService.js
/**
 * Servicio dedicado a la generación de PDFs para Requisiciones usando PDFKit.
 */
const PDFDocument = require('pdfkit');
const path = require('path');

// --- Funciones de Dibujo (Helpers) para PDFKit ---

function drawHeader(doc, data) {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (require('fs').existsSync(logoPath)) {
        doc.image(logoPath, 40, 35, { width: 60 });
    }
    
    doc.fillColor('black').fontSize(18).font('Helvetica-Bold').text('REQUISICIÓN DE MATERIALES', 0, 60, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Número Req: ${data.numero_requisicion}`, 400, 50, { align: 'right' });
    doc.text(`Fecha de Aprobación: ${new Date().toLocaleDateString('es-MX')}`, 400, 65, { align: 'right' });
}

function drawInfoGeneral(doc, data, approverName) {
    let currentY = 140;
    doc.rect(40, currentY - 5, 532, 25).fillAndStroke('#F3F4F6', '#F3F4F6');
    doc.fontSize(12).fillColor('#002D62').font('Helvetica-Bold').text('Información General', 45, currentY);
    currentY += 35;

    const col1X = 50, col2X = 320;
    const labelWidth = 70, valueWidth = 180;

    doc.fontSize(10).fillColor('black');
    doc.font('Helvetica-Bold').text('Solicitante:', col1X, currentY).font('Helvetica').text(data.usuario_creador, col1X + labelWidth + 5, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('Aprobado por:', col2X, currentY).font('Helvetica').text(approverName, col2X + labelWidth + 5, currentY, { width: valueWidth });
    currentY += 15;
    doc.font('Helvetica-Bold').text('Departamento:', col1X, currentY).font('Helvetica').text(data.departamento_codigo, col1X + labelWidth + 5, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('Fecha Req:', col2X, currentY).font('Helvetica').text(new Date(data.fecha_requerida).toLocaleDateString('es-MX'), col2X + labelWidth + 5, currentY, { width: valueWidth });
    currentY += 15;
    doc.font('Helvetica-Bold').text('Proyecto:', col1X, currentY).font('Helvetica').text(data.proyecto, col1X + labelWidth + 5, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('Lugar Entrega:', col2X, currentY).font('Helvetica').text(data.lugar_entrega_nombre, col2X + labelWidth + 5, currentY, { width: valueWidth });
    
    return currentY + 30;
}

function drawTable(doc, materials, startY) {
    let currentY = startY;
    const tableTop = currentY;
    const tableHeaders = ['Material', 'SKU', 'Cantidad', 'Unidad', 'Comentario'];
    const tableHeaderPositions = [45, 250, 330, 400, 460];
    const tableHeaderWidths = [200, 70, 60, 60, 110];

    doc.rect(40, tableTop - 5, 532, 20).fillAndStroke('#F3F4F6', '#F3F4F6');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#002D62');
    tableHeaders.forEach((header, i) => {
        doc.text(header, tableHeaderPositions[i], tableTop, { width: tableHeaderWidths[i], align: i > 0 ? 'center' : 'left' });
    });
    currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(10).fillColor('black');

    materials.forEach(item => {
        const materialHeight = doc.heightOfString(item.material, { width: tableHeaderWidths[0] });
        const comentarioHeight = doc.heightOfString(item.comentario || 'N/A', { width: tableHeaderWidths[4] });
        const rowHeight = Math.max(materialHeight, comentarioHeight) + 10; // +10 for padding

        if (currentY + rowHeight > doc.page.height - 70) { // 70 is a safe margin for the footer
            doc.addPage();
            currentY = 40; // Reset Y position for the new page
            // Redraw headers on new page
            doc.rect(40, currentY - 5, 532, 20).fillAndStroke('#F3F4F6', '#F3F4F6');
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#002D62');
            tableHeaders.forEach((header, i) => {
                doc.text(header, tableHeaderPositions[i], currentY, { width: tableHeaderWidths[i], align: i > 0 ? 'center' : 'left' });
            });
            currentY += 25;
            doc.font('Helvetica').fontSize(10).fillColor('black');
        }

        doc.text(item.material, tableHeaderPositions[0], currentY, { width: tableHeaderWidths[0] });
        doc.text(item.sku || 'N/A', tableHeaderPositions[1], currentY, { width: tableHeaderWidths[1], align: 'center' });
        doc.text(parseFloat(item.cantidad).toFixed(2), tableHeaderPositions[2], currentY, { width: tableHeaderWidths[2], align: 'center' });
        doc.text(item.unidad, tableHeaderPositions[3], currentY, { width: tableHeaderWidths[3], align: 'center' });
        doc.text(item.comentario || 'N/A', tableHeaderPositions[4], currentY, { width: tableHeaderWidths[4] });
        
        currentY += rowHeight;
        doc.moveTo(40, currentY - 5).lineTo(572, currentY - 5).strokeColor('#EEEEEE').stroke();
    });
    return currentY;
}

function drawFooter(doc) {
    const pageBottom = doc.page.height - 70;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#555555')
        .text('El contenido de este documento es confidencial y propiedad de Grupo IG', 0, pageBottom, { align: 'center' })
        .text('Operación generada usando el Sistema Integral de Requisiciones y Abastecimiento SIRA', 0, pageBottom + 10, { align: 'center' });
}

/**
 * Genera el PDF de una requisición usando PDFKit.
 * @param {object} data - Objeto con la información de la requisición.
 * @param {string} approverName - Nombre del aprobador.
 * @returns {Promise<Buffer>} - Una promesa que se resuelve con el Buffer del PDF.
 */
const generateRequisitionPdf = (data, approverName) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'letter', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            drawHeader(doc, data);
            let currentY = drawInfoGeneral(doc, data, approverName);
            currentY = drawTable(doc, data.materiales, currentY);
            // ... Aquí puedes añadir lógica para comentarios y adjuntos si lo necesitas ...

            const pages = doc.bufferedPageRange();
            for (let i = pages.start; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(doc);
            }

            doc.end();
        } catch (error) {
            console.error("Error al generar el PDF con PDFKit:", error);
            reject(error);
        }
    });
};

module.exports = { generateRequisitionPdf };
