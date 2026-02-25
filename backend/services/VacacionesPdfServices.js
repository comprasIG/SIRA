const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// --- Funciones de Dibujo (Helpers) para PDFKit ---

function drawHeader(doc, data) {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 35, { width: 80 });
    }
    
    // Título centrado y estatus tipo "sello"
    doc.fillColor('#002D62').fontSize(10).font('Helvetica-Bold').text('FORMATO DE SOLICITUD DE VACACIONES', 0, 55, { align: 'center' });
    
    doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
    doc.text(`Folio Solicitud: `, 400, 45, { continued: true }).font('Helvetica').text(`${data.id || 'N/A'}`);
    
    // Formatear fecha de solicitud de manera segura
    let fechaSol = 'N/A';
    if (data.fecha_solicitud) {
        const d = data.fecha_solicitud instanceof Date ? data.fecha_solicitud : new Date(data.fecha_solicitud);
        fechaSol = d.toLocaleDateString('es-MX');
    }

    doc.font('Helvetica-Bold').text(`Fecha Solicitud: `, 400, 60, { continued: true }).font('Helvetica').text(fechaSol);
    
    // Estatus tipo "Sello"
    let estatusColor = '#F59E0B'; // Ambar para pendiente
    if(data.estatus === 'Aprobada') estatusColor = '#10B981'; // Verde
    if(data.estatus === 'Rechazada') estatusColor = '#EF4444'; // Rojo

    doc.roundedRect(400, 75, 100, 20, 5).fillAndStroke('white', estatusColor);
    doc.fillColor(estatusColor).font('Helvetica-Bold').fontSize(10).text(data.estatus ? data.estatus.toUpperCase() : 'PENDIENTE', 400, 81, { width: 100, align: 'center' });
}

function drawInfoColaborador(doc, data) {
    let currentY = 130;
    
    // Título de sección
    doc.rect(40, currentY, 532, 25).fillAndStroke('#F3F4F6', '#F3F4F6');
    doc.fontSize(12).fillColor('#002D62').font('Helvetica-Bold').text('1. Datos del Colaborador', 45, currentY + 7);
    currentY += 35;

    const col1X = 50, col2X = 320;
    const labelWidth = 80, valueWidth = 170;

    doc.fontSize(10).fillColor('black');
    
    // Fila 1
    doc.font('Helvetica-Bold').text('Nombre:', col1X, currentY).font('Helvetica').text(data.empleado || 'N/A', col1X + labelWidth, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('No. Empleado:', col2X, currentY).font('Helvetica').text(data.num_empl || 'N/A', col2X + labelWidth, currentY, { width: valueWidth });
    currentY += 20;
    
    // Fila 2
    doc.font('Helvetica-Bold').text('Departamento:', col1X, currentY).font('Helvetica').text(data.departamento || 'N/A', col1X + labelWidth, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('Puesto:', col2X, currentY).font('Helvetica').text(data.puesto || 'N/A', col2X + labelWidth, currentY, { width: valueWidth });
    currentY += 20;

    // Fila 3
    let fechaIngreso = 'N/A';
    if (data.fecha_ingreso) {
        const d = data.fecha_ingreso instanceof Date ? data.fecha_ingreso : new Date(data.fecha_ingreso);
        fechaIngreso = d.toLocaleDateString('es-MX', { timeZone: 'UTC' });
    }

    doc.font('Helvetica-Bold').text('Fecha Ingreso:', col1X, currentY).font('Helvetica').text(fechaIngreso, col1X + labelWidth, currentY, { width: valueWidth });
    doc.font('Helvetica-Bold').text('Periodo (Año):', col2X, currentY).font('Helvetica').text(data.periodo_antiguedad ? `Año ${data.periodo_antiguedad}` : 'N/A', col2X + labelWidth, currentY, { width: valueWidth });
    
    return currentY + 30;
}

function drawDetallesVacaciones(doc, data, startY) {
    let currentY = startY;

    // Título de sección
    doc.rect(40, currentY, 532, 25).fillAndStroke('#F3F4F6', '#F3F4F6');
    doc.fontSize(12).fillColor('#002D62').font('Helvetica-Bold').text('2. Detalle de Días Solicitados', 45, currentY + 7);
    currentY += 35;

    const col1X = 50;
    const labelWidth = 110;

    // Fechas LARGAS para inicio y fin
    const formatearFechaLarga = (fechaVal) => {
        if (!fechaVal) return 'N/A';
        try {
            const d = fechaVal instanceof Date ? fechaVal : new Date(fechaVal);
            if (isNaN(d.getTime())) return 'N/A';
            return d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        } catch(e) { return 'N/A'; }
    };

    // Fecha CORTA para reincorporación (ahorra espacio)
    const formatearFechaCorta = (fechaVal) => {
        if (!fechaVal) return 'N/A';
        try {
            const d = fechaVal instanceof Date ? fechaVal : new Date(fechaVal);
            if (isNaN(d.getTime())) return 'N/A';
            return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' });
        } catch(e) { return 'N/A'; }
    };

    const fInicio = formatearFechaLarga(data.fecha_inicio);
    const fFin = formatearFechaLarga(data.fecha_fin);
    const fRetorno = formatearFechaCorta(data.fecha_retorno);

    doc.fontSize(10).fillColor('black');
    
    doc.font('Helvetica-Bold').text('Fecha de Inicio:', col1X, currentY).font('Helvetica').text(fInicio, col1X + labelWidth, currentY, { width: 250 });
    currentY += 20;
    
    doc.font('Helvetica-Bold').text('Fecha de Fin:', col1X, currentY).font('Helvetica').text(fFin, col1X + labelWidth, currentY, { width: 250 });
    currentY += 20;

    // Etiqueta más corta y fecha más breve
    doc.font('Helvetica-Bold').text('Reincorporación:', col1X, currentY).font('Helvetica').text(fRetorno, col1X + labelWidth, currentY, { width: 250 });
    currentY += 25;

    // ==========================================
    // CUADROS DE DÍAS (SOLICITADOS VS RESTANTES)
    // ==========================================
    const boxWidth = 180;
    
    // Cuadro 1: Días a Descontar
    doc.roundedRect(col1X, currentY, boxWidth, 30, 5).fillAndStroke('#E0E7FF', '#C7D2FE');
    doc.fillColor('#3730A3').font('Helvetica-Bold').fontSize(11).text(`Días a Descontar: ${data.dias_solicitados}`, col1X, currentY + 9, { width: boxWidth, align: 'center' });

    // Cuadro 2: Días Restantes
    doc.roundedRect(col1X + boxWidth + 20, currentY, boxWidth, 30, 5).fillAndStroke('#F3F4F6', '#D1D5DB');
    doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(11).text(`Días Restantes: ${data.dias_restantes ?? 'N/A'}`, col1X + boxWidth + 20, currentY + 9, { width: boxWidth, align: 'center' });
    
    currentY += 45;

    doc.fillColor('black').font('Helvetica-Bold').fontSize(10).text('Comentarios / Observaciones:', col1X, currentY);
    currentY += 15;
    doc.font('Helvetica').text(data.observaciones || 'Ninguno.', col1X, currentY, { width: 470 });

    return currentY + 50;
}

function drawSignatures(doc, data, startY) {
    let currentY = startY + 50; 

    // Si nos pasamos de página con las firmas, creamos una nueva
    if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 100;
    }

    doc.fontSize(10).fillColor('black').font('Helvetica');

    const signatureWidth = 150;
    const yLine = currentY + 30; // Coordenada de la línea de firma

    // Firma 1: Solicitante
    doc.moveTo(70, yLine).lineTo(70 + signatureWidth, yLine).strokeColor('black').stroke();
    doc.font('Helvetica-Bold').fontSize(8).text(data.empleado || 'Colaborador', 70, yLine + 10, { width: signatureWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9).text('Firma del Solicitante', 70, yLine + 25, { width: signatureWidth, align: 'center' });

    // Firma 2: Jefe Inmediato / Autoriza
    const centerStart = (doc.page.width / 2) - (signatureWidth / 2);
    doc.moveTo(centerStart, yLine).lineTo(centerStart + signatureWidth, yLine).strokeColor('black').stroke();
    doc.font('Helvetica').fontSize(9).text('Autoriza (Jefe Inmediato)', centerStart, yLine + 25, { width: signatureWidth, align: 'center' });

    // Firma 3: Recursos Humanos
    const rightStart = doc.page.width - 70 - signatureWidth;
    doc.moveTo(rightStart, yLine).lineTo(rightStart + signatureWidth, yLine).strokeColor('black').stroke();
    doc.font('Helvetica').fontSize(9).text('Vo. Bo. Recursos Humanos', rightStart, yLine + 25, { width: signatureWidth, align: 'center' });

    // Nota Legal pequeña
    doc.fontSize(8).fillColor('#6B7280').text('Nota: El colaborador declara que la información proporcionada es correcta. La autorización de esta solicitud está sujeta a las necesidades de la operación del área y las políticas internas de la empresa.', 50, yLine + 60, { width: 512, align: 'justify' });
}

function drawFooter(doc) {
    const pageBottom = doc.page.height - 50;
    doc.moveTo(40, pageBottom - 10).lineTo(572, pageBottom - 10).strokeColor('#E5E7EB').stroke();
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#9CA3AF')
        .text('Documento generado a través del Sistema SIRA - Administración de Personal', 0, pageBottom, { align: 'center' });
}

/**
 * Genera el PDF de la solicitud de vacaciones.
 * @param {object} data - Datos combinados de la solicitud y el empleado.
 * @returns {Promise<Buffer>}
 */
const generateVacacionesPdf = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'letter', bufferPages: true });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            drawHeader(doc, data);
            let currentY = drawInfoColaborador(doc, data);
            currentY = drawDetallesVacaciones(doc, data, currentY);
            drawSignatures(doc, data, currentY);

            // Agregar el footer en todas las páginas generadas
            const pages = doc.bufferedPageRange();
            for (let i = pages.start; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(doc);
            }

            doc.end();
        } catch (error) {
            console.error("Error al generar PDF de vacaciones:", error);
            reject(error);
        }
    });
};

module.exports = { generateVacacionesPdf };