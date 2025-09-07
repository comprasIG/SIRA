// C:\SIRA\backend\services\emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config(); 

// CAMBIO: Se usan las variables SMTP_* para que coincidan con tu archivo .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, // true para el puerto 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

/**
 * Envía un correo electrónico con un PDF adjunto.
 */
const sendRequisitionEmail = async (recipients, subject, htmlBody, pdfBuffer, fileName) => {
    const mailOptions = {
        // CAMBIO: Se usa SMTP_USER para el remitente
        from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody,
        attachments: [
            {
                filename: fileName,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado con éxito:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error CRÍTICO al intentar enviar el correo:', error);
        // Lanzamos el error para que la función que llama (aprobarYNotificar) lo sepa
        throw error; 
    }
};

module.exports = {
    sendRequisitionEmail,
};