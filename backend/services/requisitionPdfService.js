// C:\SIRA\backend\services\requisitionPdfService.js
const PDFDocument = require('pdfkit');
const path = require('path');

// --- Funciones de Dibujo (Helpers) ---

function drawHeader(doc, data) {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (require('fs').existsSync(logoPath)) {
        doc.image(logoPath, 40, 35, { width: 60 });
    }
    doc.fontSize(10).fillColor('#002D62').font('Helvetica-Bold').text('GRUPO IG', 40, 100);

    doc.fillColor('black').fontSize(18).font('Helvetica-Bold').text('REQUISICIÓN DE MATERIALES', 0, 60, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Número Req: ${data.numero_requisicion}`, 400, 50, { align: 'right' });
    doc.text(`Fecha de Aprobación: ${new Date().toLocaleDateString('es-MX')}`, 400, 65, { align: 'right' });
}

function drawInfoGeneral(doc, data, approverName) {
    let currentY = 140;
    doc.rect(40, currentY - 5, 532, 25).fill('#F3F4F6').stroke('#F3F4F6');
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
    doc.font('Helvetica-Bold').text('Lugar Entrega:', col2X, currentY).font('Helvetica').text(data.lugar_entrega, col2X + labelWidth + 5, currentY, { width: valueWidth });
    
    return currentY + 30; // Devuelve la posición Y para continuar dibujando
}

function drawTable(doc, materials, startY) {
    let currentY = startY;
    const tableTop = currentY;
    const tableHeaders = ['Material', 'Cantidad', 'Unidad', 'Comentario'];
    const tableHeaderPositions = [45, 320, 400, 450];
    const tableHeaderWidths = [260, 60, 60, 120];

    doc.rect(40, tableTop - 5, 532, 20).fill('#F3F4F6').stroke('#F3F4F6');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#002D62');
    tableHeaders.forEach((header, i) => {
        doc.text(header, tableHeaderPositions[i], tableTop, { width: tableHeaderWidths[i], align: i > 0 ? 'center' : 'left' });
    });
    currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(10).fillColor('black');

    materials.forEach(item => {
        const itemMaterial = item.material;
        const itemCantidad = parseFloat(item.cantidad).toFixed(2);
        const itemUnidad = item.unidad;
        const itemComentario = item.comentario || 'N/A';
        
        const materialHeight = doc.heightOfString(itemMaterial, { width: tableHeaderWidths[0] });
        const comentarioHeight = doc.heightOfString(itemComentario, { width: tableHeaderWidths[3] });
        const rowHeight = Math.max(materialHeight, comentarioHeight, 15);

        if (currentY + rowHeight > doc.page.height - 80) { // Margen para el footer
            doc.addPage();
            currentY = 40;
            doc.rect(40, currentY - 5, 532, 20).fill('#F3F4F6').stroke('#F3F4F6');
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#002D62');
            tableHeaders.forEach((header, i) => {
                doc.text(header, tableHeaderPositions[i], currentY, { width: tableHeaderWidths[i], align: i > 0 ? 'center' : 'left' });
            });
            currentY += 25;
            doc.font('Helvetica').fontSize(10).fillColor('black');
        }

        doc.text(itemMaterial, tableHeaderPositions[0], currentY, { width: tableHeaderWidths[0] });
        doc.text(itemCantidad, tableHeaderPositions[1], currentY, { width: tableHeaderWidths[1], align: 'center' });
        doc.text(itemUnidad, tableHeaderPositions[2], currentY, { width: tableHeaderWidths[2], align: 'center' });
        doc.text(itemComentario, tableHeaderPositions[3], currentY, { width: tableHeaderWidths[3] });
        
        currentY += rowHeight + 5;
        doc.moveTo(40, currentY - 2).lineTo(572, currentY - 2).strokeColor('#EEEEEE').stroke();
    });
    return currentY;
}

function drawFooter(doc) {
    const pageBottom = doc.page.height - 50;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#555555')
        .text('Este documento es propiedad de Grupo IG.', 40, pageBottom, { align: 'center' })
        .text('Documento generado por SIRA PROJECT', 40, pageBottom + 10, { align: 'center' });
}

/**
 * Genera el PDF de una requisición en memoria (Buffer).
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

            // ... Lógica futura para comentarios y adjuntos ...

            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(doc);
            }

            doc.end();

        } catch (error) {
            console.error("Error al generar el PDF:", error);
            reject(error);
        }
    });
};

module.exports = { generateRequisitionPdf };