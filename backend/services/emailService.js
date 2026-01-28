// C:\SIRA\backend\services\emailService.js
/**
 * =================================================================================================
 * SERVICIO: Envío de Correo (Versión con Firma + Deduplicación de Adjuntos)
 * =================================================================================================
 * Objetivo:
 * - Enviar correos con múltiples adjuntos
 * - Incluir firma embebida (imagen con CID)
 * - Evitar adjuntos duplicados (ej. PDF repetido 2 veces)
 * =================================================================================================
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

// ================================================================================================
// Transporter (sin cambios)
// ================================================================================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true, // true para 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// ================================================================================================
// Firma embebida (sin cambios funcionales)
// ================================================================================================

const signaturePath = path.join(__dirname, '..', 'assets', 'firmas electronicas-GrupoIG.jpg');
const signatureCid = 'sira-firma-ig@grupoig.com';
let signatureAttachment = null;
let signatureHtml = '';

if (fs.existsSync(signaturePath)) {
  signatureAttachment = {
    filename: 'firmas electronicas-GrupoIG.jpg',
    path: signaturePath,
    cid: signatureCid,
  };
  signatureHtml = `<br><br><img src="cid:${signatureCid}" alt="Firma Grupo IG" />`;
} else {
  console.warn(`[EmailService] Archivo de firma no encontrado. Se omitirá. Ruta esperada: ${signaturePath}`);
}

// ================================================================================================
// Helpers: dedupe adjuntos
// ================================================================================================

const _isValidAttachment = (att) => {
  if (!att) return false;
  if (!att.filename) return false;

  // nodemailer acepta attachments con `content` (Buffer/string) o con `path`
  const hasContent = att.content != null;
  const hasPath = typeof att.path === 'string' && att.path.trim().length > 0;

  return hasContent || hasPath || att.cid; // la firma por CID puede venir con path
};

const _hashContent = (content) => {
  try {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
    return crypto.createHash('sha1').update(buf).digest('hex');
  } catch {
    return null;
  }
};

/**
 * Dedup:
 * - Si tiene `cid` => clave por cid (evita duplicar firma)
 * - Si tiene `content` => filename + size + sha1
 * - Si tiene `path` => filename + path
 */
const _dedupeAttachments = (attachments = []) => {
  const seen = new Set();
  const result = [];

  for (const att of attachments) {
    if (!_isValidAttachment(att)) continue;

    let key = null;

    if (att.cid) {
      key = `cid:${att.cid}`;
    } else if (att.content != null) {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(String(att.content));
      const sha1 = _hashContent(buf) || 'nohash';
      key = `content:${att.filename}:${buf.length}:${sha1}`;
    } else if (att.path) {
      key = `path:${att.filename}:${String(att.path)}`;
    } else {
      key = `unknown:${att.filename}`;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(att);
  }

  return result;
};

// ================================================================================================
// API pública
// ================================================================================================

/**
 * Envía correo con múltiples adjuntos y firma embebida.
 * - recipients: array de correos
 * - subject: string
 * - htmlBody: string
 * - attachments: [{ filename, content|path, ... }]
 */
const sendEmailWithAttachments = async (recipients, subject, htmlBody, attachments = []) => {
  const base = Array.isArray(attachments) ? attachments : [];

  // Agregar firma (si existe)
  const withSignature = signatureAttachment ? [...base, signatureAttachment] : [...base];

  // Deduplicar
  const finalAttachments = _dedupeAttachments(withSignature);

  const mailOptions = {
    from: `"SIRA PROJECT" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject,
    html: String(htmlBody ?? '') + signatureHtml,
    attachments: finalAttachments,
  };

  console.log(
    `[EmailService] Enviando correo a [${recipients.join(', ')}] con ${finalAttachments.length} adjunto(s).`
  );

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] Correo enviado con éxito:', info.messageId);
    return info;
  } catch (error) {
    console.error('[EmailService] Error CRÍTICO al enviar correo:', error);
    throw new Error('Fallo en el envío del correo de notificación.');
  }
};

/**
 * Compatibilidad con función antigua (requisición)
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
  return sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
};

module.exports = {
  sendRequisitionEmail,
  sendEmailWithAttachments,
};
