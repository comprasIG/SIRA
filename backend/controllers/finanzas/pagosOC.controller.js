// C:\SIRA\backend\controllers\finanzas\pagosOC.controller.js

const path = require('path');
const pool = require('../../db/pool');
const { sendEmailWithAttachments } = require('../../services/emailService');
const { 
  uploadMulterFileToOcFolder,
  getOcFolderWebLink
} = require('../../services/googleDrive');

/** Correos por grupo (usa client o pool indistintamente) */
const getNotificationEmails = async (groupCode, clientOrPool = pool) => {
  const q = `
    SELECT u.correo FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
  const res = await clientOrPool.query(q, [groupCode]);
  return res.rows.map(r => r.correo);
};

/** Info de OC (con proveedor) */
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
 *  Campos (form-data):
 *   - comprobante: archivo (pdf/imagen)
 *   - tipo_pago: 'TOTAL' | 'ANTICIPO' (antes 'PARCIAL')
 *   - monto: number (requerido si ANTICIPO; opcional si TOTAL -> se calcula saldo)
 *   - comentario: string (opcional)
 * =============================== */
const registrarPago = async (req, res) => {
  const { id: ordenCompraId } = req.params;

  // Normalización: aceptamos variantes y mapeamos al CHECK de BD ('TOTAL' | 'ANTICIPO')
  const rawTipo = (req.body?.tipo_pago ?? '').toString().trim().toUpperCase();
  const tipoCanonico =
    ['TOTAL', 'PAGO_TOTAL'].includes(rawTipo) ? 'TOTAL' :
    ['ANTICIPO', 'PARCIAL', 'ABONO', 'PAGO_PARCIAL'].includes(rawTipo) ? 'ANTICIPO' :
    null;

  if (!tipoCanonico) {
    return res.status(400).json({
      error: `tipo_pago inválido (${rawTipo}). Usa TOTAL o ANTICIPO (PARCIAL).`
    });
  }

  // Monto (admite coma decimal)
  const montoRaw = (req.body?.monto ?? '').toString().replace(',', '.');
  const comentario = req.body?.comentario;
  const archivo = req.file; // field: 'comprobante'
  const usuarioId = req.usuarioSira?.id;

  try {
    if (!archivo) return res.status(400).json({ error: 'No se envió el comprobante.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Info de OC (FOR UPDATE)
      const ocBefore = await getOcInfo(ordenCompraId, client, true);
      const { numero_oc, metodo_pago, status, proveedor_nombre, total } = ocBefore;

      const pagadoAntes = Number(ocBefore.monto_pagado || 0);
      const totalNum = Number(total || 0);
      const saldo = Math.max(0, totalNum - pagadoAntes);

      // Validaciones de monto
      let montoAplicar = Number(montoRaw);
      if (tipoCanonico === 'ANTICIPO') {
        if (!(montoAplicar > 0)) {
          return res.status(400).json({ error: 'Monto requerido para ANTICIPO.' });
        }
      } else {
        // TOTAL: si no envían monto o no es válido, tomamos el saldo
        if (!(montoAplicar > 0)) {
          if (saldo <= 0) return res.status(400).json({ error: 'La OC ya está liquidada.' });
          montoAplicar = saldo;
        }
      }
      if (montoAplicar > saldo) montoAplicar = saldo; // evita sobrepago

      // Subir comprobante a la carpeta de la OC
      const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const guessedPdf = (archivo.mimetype || '').includes('pdf');
      const extFromName = path.extname(archivo.originalname || '');
      const ext = extFromName || (guessedPdf ? '.pdf' : '');
      const safeMonto = Number(montoAplicar).toFixed(2).replace('.', '_');
      const fileName = `COMPROBANTE_PAGO_${numero_oc}_${ts}_${safeMonto}${ext}`;

      const driveFile = await uploadMulterFileToOcFolder(archivo, numero_oc, fileName);
      if (!driveFile || !driveFile.webViewLink) throw new Error('Falló la subida del comprobante a Drive.');

      // Registrar el pago
      const pagoQ = await client.query(`
        INSERT INTO pagos_oc
          (orden_compra_id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario)
        VALUES ($1, now(), $2, $3, $4, $5, $6)
        RETURNING id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario
      `, [ordenCompraId, montoAplicar, tipoCanonico, usuarioId, driveFile.webViewLink, comentario || null]);
      const pago = pagoQ.rows[0];

      // Actualizar OC (monto_pagado y status según SPEI)
      const nuevoMontoPagado = pagadoAntes + montoAplicar;
      let nuevoStatus = status;
      let setComprobanteEnOC = false;

      if (metodo_pago === 'SPEI') {
        if (status === 'CONFIRMAR_SPEI') {
          nuevoStatus = 'APROBADA';
          setComprobanteEnOC = true; // guardar comprobante principal en la OC
        } else {
          nuevoStatus = 'APROBADA';
        }
      }

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
        JSON.stringify({
          tipo_pago: tipoCanonico,
          monto: montoAplicar,
          comprobante: driveFile.webViewLink,
          comentario
        })]);

      await client.query('COMMIT');

      // Correo (solo caso SPEI aprobado)
      if (metodo_pago === 'SPEI' && ocAfter.status === 'APROBADA') {
        let folderLink;
        try {
          const info = await getOcFolderWebLink(numero_oc);
          folderLink = info?.webViewLink || null;
        } catch { folderLink = null; }
        if (!folderLink) folderLink = driveFile.webViewLink;

        const recipients = await getNotificationEmails('OC_APROBADA', pool); // usa pool fuera de la tx
        if (recipients.length > 0) {
          const subject = `Comprobante SPEI registrado | OC ${numero_oc}`;
          const htmlBody = `
            <p>Se registró un comprobante de pago para la Orden de Compra <b>${numero_oc}</b>.</p>
            <ul>
              <li><b>Proveedor:</b> ${proveedor_nombre}</li>
              <li><b>Monto pagado:</b> $${Number(montoAplicar).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</li>
              <li><b>Tipo de pago:</b> ${tipoCanonico}</li>
              <li><b>Total OC:</b> $${Number(totalNum).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</li>
            </ul>
            <p>Carpeta de la OC en Drive: <a href="${folderLink}" target="_blank">${folderLink}</a></p>
            <p><i>Adjuntamos el comprobante.</i></p>
            <br><p><i>Correo automático de SIRA.</i></p>
          `;
          const attachmentName = path.basename(fileName) || `COMPROBANTE_PAGO_${numero_oc}${ext || ''}`;
          const attachments = [{ filename: attachmentName, content: archivo.buffer }];
          await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
        }
      }

      return res.status(201).json({ mensaje: 'Pago registrado', pago, oc: ocAfter });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al registrar pago OC:', err);
      return res.status(500).json({ error: err.message || 'Error al registrar pago.' });
    } finally {
      try { client.release(); } catch {}
    }
  } catch (outer) {
    console.error('Validación/Runtime error:', outer);
    return res.status(400).json({ error: outer.message || 'Error en parámetros.' });
  }
};

module.exports = { listarPagos, registrarPago };
