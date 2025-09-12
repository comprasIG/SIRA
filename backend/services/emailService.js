// C:\SIRA\backend\services\emailService.js
/**
 * =================================================================================================
 * SERVICIO: Envío de Correo (Versión Mejorada)
 * =================================================================================================
 * @description Envía correos electrónicos con soporte para múltiples archivos adjuntos.
 */
const nodemailer = require('nodemailer');
require('dotenv').config(); 

// --- Configuración del Transportador de Correo ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, // true para 465, false para otros puertos
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

/**
 * =================================================================================================
 * --- ¡NUEVA FUNCIÓN PRINCIPAL! ---
 * =================================================================================================
 * @description Envía un correo electrónico con múltiples archivos adjuntos.
 * @param {string[]} recipients - Arreglo de correos de los destinatarios.
 * @param {string} subject - Asunto del correo.
 * @param {string} htmlBody - Cuerpo del correo en HTML.
 * @param {Array<object>} attachments - Un ARREGLO de objetos de adjuntos.
 * Cada objeto debe tener { filename: 'nombre.pdf', content: bufferDeArchivo }.
 */
const sendEmailWithAttachments = async (recipients, subject, htmlBody, attachments = []) => {
    // Filtramos para asegurarnos de que solo se incluyan adjuntos válidos.
    const validAttachments = attachments.filter(att => att && att.filename && att.content);

    const mailOptions = {
        from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody,
        attachments: validAttachments, // Asignamos el arreglo de adjuntos
    };

    console.log(`Preparando para enviar correo a [${recipients.join(', ')}] con ${validAttachments.length} archivo(s) adjunto(s).`);

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo de notificación enviado con éxito:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error CRÍTICO al intentar enviar el correo:', error);
        throw new Error("Fallo en el envío del correo de notificación."); 
    }
};


/**
 * =================================================================================================
 * --- FUNCIÓN ANTIGUA (Ahora es un atajo a la nueva) ---
 * =================================================================================================
 * @description Envía un correo con un único PDF. Mantenida por retrocompatibilidad.
 */
const sendRequisitionEmail = async (recipients, subject, htmlBody, pdfBuffer, fileName) => {
    const attachments = [];
    if (pdfBuffer && fileName) {
        attachments.push({
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
        });
    }
    // Llama a la nueva función principal para hacer el trabajo.
    return sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
};

module.exports = {
    sendRequisitionEmail,
    sendEmailWithAttachments, // <-- Se exporta la nueva función
};