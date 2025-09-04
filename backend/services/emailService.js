//C:\SIRA\SIRA\backend\services\emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config(); // Carga las variables de .env

// 1. Configura el "transportador" de correo con tus credenciales de Hostinger
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, // El puerto 465 usa SSL
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD, // Usa la variable corregida
    },
});

/**
 * Envía un correo con la requisición en PDF.
 * @param {string[]} recipients - Array de correos de los destinatarios.
 * @param {string} subject - El asunto del correo.
 * @param {string} body - El cuerpo HTML del correo.
 * @param {Buffer} pdfBuffer - El PDF generado en memoria.
 * @param {string} fileName - El nombre del archivo adjunto (ej. "Requisicion_SSD_0040.pdf").
 */
const sendRequisitionEmail = async (recipients, subject, body, pdfBuffer, fileName) => {
    try {
        await transporter.sendMail({
            from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`, // Nombre del remitente y correo
            to: recipients.join(', '), // Une la lista de correos
            subject: subject,
            html: body,
            attachments: [{
                filename: fileName,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }, ],
        });
        console.log('Correo de notificación enviado con éxito a:', recipients);
    } catch (error) {
        console.error('Error al enviar el correo de notificación:', error);
        // Es importante manejar este error, pero no necesariamente detener el proceso
    }
};

module.exports = { sendRequisitionEmail };