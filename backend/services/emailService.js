// C:\SIRA\backend\services\emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config(); 

// --- Configuración del Transportador de Correo ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

/**
 * Envía un correo electrónico con un único PDF adjunto de forma segura.
 * @param {string[]} recipients - Arreglo de correos de los destinatarios.
 * @param {string} subject - Asunto del correo.
 * @param {string} htmlBody - Cuerpo del correo en HTML.
 * @param {Buffer} pdfBuffer - El PDF generado en memoria (Buffer).
 * @param {string} fileName - Nombre del archivo adjunto.
 */
const sendRequisitionEmail = async (recipients, subject, htmlBody, pdfBuffer, fileName) => {
    
    // --- Lógica Defensiva ---
    // 1. Creamos un arreglo de adjuntos vacío.
    const attachments = [];

    // 2. Verificamos que el buffer del PDF y el nombre del archivo existan antes de añadirlo.
    // Esto previene errores si la generación del PDF fallara silenciosamente.
    if (pdfBuffer && fileName) {
        attachments.push({
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
        });
    }

    // --- Opciones del Correo ---
    const mailOptions = {
        from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody,
        // 3. Asignamos nuestro arreglo de adjuntos construido de forma segura.
        attachments: attachments,
    };

    // --- Registro Detallado para Depuración ---
    // Esta línea nos dirá en la consola del backend exactamente cuántos archivos se van a enviar.
    console.log(`Preparando para enviar correo a [${recipients.join(', ')}] con ${attachments.length} archivo(s) adjunto(s).`);

    // --- Lógica de Envío ---
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo de notificación enviado con éxito:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error CRÍTICO al intentar enviar el correo:', error);
        throw new Error("Fallo en el envío del correo de notificación."); 
    }
};

module.exports = {
    sendRequisitionEmail,
};