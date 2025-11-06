// C:\SIRA\backend\services\emailService.js
/**
 * =================================================================================================
 * SERVICIO: Envío de Correo (Versión con Firma)
 * =================================================================================================
 * @description Envía correos electrónicos con soporte para múltiples archivos adjuntos
 * y una firma de imagen incrustada.
 */
const nodemailer = require('nodemailer');
const path = require('path'); // Necesario para la ruta de la firma
const fs = require('fs'); // Necesario para leer la firma
require('dotenv').config(); 

// --- Configuración del Transportador de Correo (sin cambios) ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, // true para 465, false para otros puertos
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

// =================================================================
// --- ¡NUEVO: Lógica de Firma Incrustada! ---
// =================================================================
const signaturePath = path.join(__dirname, '..', 'assets', 'firmas electronicas-GrupoIG.jpg');
const signatureCid = 'sira-firma-ig@grupoig.com'; // ID único para la imagen
let signatureAttachment = null;
let signatureHtml = '';

// Leer la imagen de firma solo una vez al iniciar el servidor
if (fs.existsSync(signaturePath)) {
    signatureAttachment = {
        filename: 'firmas electronicas-GrupoIG.jpg',
        path: signaturePath,
        cid: signatureCid // El Content-ID que usará el HTML
    };
    signatureHtml = `<br><br><img src="cid:${signatureCid}" alt="Firma Grupo IG" />`;
} else {
    console.warn(`[EmailService] Archivo de firma no encontrado. Se omitirá. Ruta esperada: ${signaturePath}`);
}
// =================================================================

/**
 * =================================================================================================
 * --- FUNCIÓN PRINCIPAL (Modificada) ---
 * =================================================================================================
 * @description Envía un correo electrónico con múltiples archivos adjuntos y la firma.
 */
const sendEmailWithAttachments = async (recipients, subject, htmlBody, attachments = []) => {
    // Filtramos para asegurarnos de que solo se incluyan adjuntos válidos.
    const validAttachments = attachments.filter(att => att && att.filename && att.content);

    // --- CAMBIO: Añadir la firma a los adjuntos ---
    if (signatureAttachment) {
        validAttachments.push(signatureAttachment);
    }

    const mailOptions = {
        from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: subject,
        // --- CAMBIO: Añadir el HTML de la firma al cuerpo ---
        html: htmlBody + signatureHtml, 
        attachments: validAttachments,
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
 * --- FUNCIÓN ANTIGUA (Sin cambios, depende de la principal) ---
 * =================================================================================================
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
    sendEmailWithAttachments,
};