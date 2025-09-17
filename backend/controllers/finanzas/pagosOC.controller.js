// C:\SIRA\backend\controllers\finanzas\pagosOC.controller.js

const pool = require('../../db/pool');
const { uploadPdfBuffer, getFolderIdByPath } = require('../../services/googleDrive');
const { sendEmailWithAttachments } = require('../../services/emailService');

/** Correos por grupo */
const getNotificationEmails = async (groupCode, client) => {
  const q = `
    SELECT u.correo FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
  const res = await client.query(q, [groupCode]);
  return res.rows.map(r => r.correo);
};

/** Info de OC */
const getOcInfo = async (ocId, client, forUpdate = false) => {
  const q = `
    SELECT oc.id, oc.numero_oc, oc.metodo_pago, oc.status, oc.total, oc.monto_pagado,
           oc.fecha_vencimiento_pago, oc.proveedor_id, p.razon_social AS proveedor_nombre
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    WHERE oc.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}
  `;
  const res = await client.query(q, [ocId]);
  if (res.rowCount === 0) throw new Error('OC no encontrada');
  return res.rows[0];
};

/** Link a carpeta de OC */
const getOcDriveFolderLink = async (numeroOC) => {
  if (typeof getFolderIdByPath === 'function') {
    const folderId = await getFolderIdByPath(['ORDENES DE COMPRA (PDF)', numeroOC]); // <- carpeta + subcarpeta OC-#####
    if (folderId) return `https://drive.google.com/drive/folders/${folderId}`;
  }
  return null;
};

/** ===============================
 *  GET /api/finanzas/oc/:id/pagos
 * =============================== */
const listarPagos = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const query = `
      SELECT p.id, p.fecha_pago, p.monto, p.tipo_pago, p.usuario_id, u.nombre as usuario_nombre,
             p.comprobante_link, p.comentario
      FROM pagos_oc p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.orden_compra_id = $1
      ORDER BY p.fecha_pago ASC
    `;
    const result = await pool.query(query, [ordenCompraId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar pagos de OC:', err);
    res.status(500).json({ error: 'Error al listar pagos.' });
  }
};

/** ===============================
 *  POST /api/finanzas/oc/:id/pagos
 *  Sube comprobante, actualiza OC y manda correo para SPEI
 * =============================== */
const registrarPago = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { tipo_pago, monto, comentario } = req.body; // tipo_pago: TOTAL | ANTICIPO
  const usuarioId = req.usuarioSira?.id;
  const archivo = req.file; // field: comprobante

  if (!archivo) return res.status(400).json({ error: 'No se envió el comprobante.' });
  if (!['TOTAL', 'ANTICIPO'].includes(tipo_pago)) return res.status(400).json({ error: 'Tipo de pago inválido.' });
  const montoNum = Number(monto);
  if (!montoNum || isNaN(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'Monto de pago inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Traemos OC con FOR UPDATE
    const ocBefore = await getOcInfo(ordenCompraId, client, true);
    const { numero_oc, metodo_pago, status, proveedor_nombre, total } = ocBefore;

    // Subir comprobante a la carpeta de la OC
    const fileName = `COMPROBANTE_PAGO_${numero_oc}_${Date.now()}.pdf`;
    const driveFile = await uploadPdfBuffer(
      archivo.buffer,
      fileName,
      'ORDENES DE COMPRA (PDF)',
      numero_oc
    );
    if (!driveFile || !driveFile.webViewLink) throw new Error('Falló la subida a Drive');

    // Registrar el pago
    const pagoQ = await client.query(`
      INSERT INTO pagos_oc
        (orden_compra_id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario)
      VALUES ($1, now(), $2, $3, $4, $5, $6)
      RETURNING id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario
    `, [ordenCompraId, montoNum, tipo_pago, usuarioId, driveFile.webViewLink, comentario || null]);
    const pago = pagoQ.rows[0];

    // Actualizar monto_pagado y status si corresponde
    const nuevoMontoPagado = Number(ocBefore.monto_pagado || 0) + montoNum;
    let nuevoStatus = ocBefore.status;
    let setComprobanteEnOC = false;

    // Reglas SPEI:
    // - Si estaba en CONFIRMAR_SPEI -> al registrar el primer pago pasa a APROBADA.
    // - Si suma alcanza o supera total -> sigue APROBADA pero ya no queda "por liquidar".
    if (metodo_pago === 'SPEI') {
      if (status === 'CONFIRMAR_SPEI') {
        nuevoStatus = 'APROBADA';
        setComprobanteEnOC = true; // guardamos comprobante principal
      } else {
        // Ya estaba APROBADA: puede ser parcial o liquidación total.
        nuevoStatus = 'APROBADA';
      }
    }

    // Actualiza OC
    const updQ = await client.query(`
      UPDATE ordenes_compra
      SET monto_pagado = $1,
          status = $2,
          ${setComprobanteEnOC ? 'comprobante_pago_link = $3,' : ''}
          actualizado_en = now()
      WHERE id = $4
      RETURNING id, numero_oc, status, metodo_pago, total, monto_pagado, comprobante_pago_link
    `, setComprobanteEnOC
        ? [nuevoMontoPagado, nuevoStatus, driveFile.webViewLink, ordenCompraId]
        : [nuevoMontoPagado, nuevoStatus, ordenCompraId]);
    const ocAfter = updQ.rows[0];

    // Historial
    await client.query(`
      INSERT INTO ordenes_compra_historial
        (orden_compra_id, usuario_id, accion_realizada, detalles)
      VALUES ($1, $2, $3, $4)
    `, [ordenCompraId, usuarioId, 'REGISTRO DE PAGO',
      JSON.stringify({ tipo_pago, monto: montoNum, comprobante: driveFile.webViewLink, comentario })]);

    await client.query('COMMIT');

    // Correo solo para SPEI aprobadas (con comprobante adjunto)
    if (metodo_pago === 'SPEI' && ocAfter.status === 'APROBADA') {
      let driveFolderLink = await getOcDriveFolderLink(numero_oc);
      if (!driveFolderLink) driveFolderLink = driveFile.webViewLink;

      const recipients = await getNotificationEmails('OC_APROBADA', client);
      if (recipients.length > 0) {
        const subject = `Comprobante SPEI registrado | OC ${numero_oc}`;
        const htmlBody = `
          <p>Se registró un comprobante de pago para la Orden de Compra <b>${numero_oc}</b>.</p>
          <ul>
            <li><b>Proveedor:</b> ${proveedor_nombre}</li>
            <li><b>Monto pagado:</b> $${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</li>
            <li><b>Tipo de pago:</b> ${tipo_pago}</li>
            <li><b>Total OC:</b> $${Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</li>
          </ul>
          <p>Puedes acceder a la carpeta de Drive (OC y comprobantes): <a href="${driveFolderLink}" target="_blank">${driveFolderLink}</a></p>
          <br><p><i>Correo automático de SIRA.</i></p>
        `;
        const attachments = [{
          filename: `COMPROBANTE_PAGO_${numero_oc}.pdf`,
          content: archivo.buffer
        }];
        await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
      }
    }

    res.status(201).json({ mensaje: 'Pago registrado', pago, oc: ocAfter });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pago OC:', err);
    res.status(500).json({ error: err.message || 'Error al registrar pago.' });
  } finally {
    client.release();
  }
};

module.exports = { listarPagos, registrarPago };
