// C:\SIRA\backend\controllers\finanzas\pagosOC.controller.js

const path = require('path');
const pool = require('../../db/pool');
const { sendEmailWithAttachments } = require('../../services/emailService');
const {
  uploadOcPaymentReceipt,
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

/** Info de OC (con proveedor y metadatos Drive) */
const getOcInfo = async (ocId, client, forUpdate = false) => {
  const q = `
    SELECT oc.id, oc.numero_oc, oc.metodo_pago, oc.status, oc.total, oc.monto_pagado,
           oc.fecha_vencimiento_pago, oc.proveedor_id, p.razon_social AS proveedor_nombre,
           r.numero_requisicion, d.codigo AS depto_codigo
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN requisiciones r ON oc.rfq_id = r.id
    JOIN departamentos d ON r.departamento_id = d.id
    WHERE oc.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}
  `;
  const res = await client.query(q, [ocId]);
  if (res.rowCount === 0) throw new Error('OC no encontrada');
  return res.rows[0];
};

const parseFechaYYYYMMDD = (s) => {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

/** ===============================
 *  GET /api/finanzas/oc/:id/pagos
 * =============================== */
const listarPagos = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const query = `
      SELECT 
        p.id,
        p.fecha_pago,
        p.monto,
        p.tipo_pago,
        p.usuario_id,
        u.nombre as usuario_nombre,
        p.comprobante_link,
        p.comentario,
        p.fuente_pago_id,
        fp.nombre AS fuente_pago_nombre,
        p.reversa_de_pago_id,
        p.fecha_compromiso_pago
      FROM pagos_oc p
      JOIN usuarios u ON p.usuario_id = u.id
      JOIN catalogo_fuentes_pago fp ON p.fuente_pago_id = fp.id
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
 *  form-data:
 *   - comprobante (file)
 *   - tipo_pago: TOTAL | ANTICIPO
 *   - monto: requerido si ANTICIPO
 *   - comentario (opcional)
 *   - fuente_pago_id (requerido)
 *   - fecha_compromiso_pago (YYYY-MM-DD) requerido si ANTICIPO (próximo compromiso)
 * =============================== */
const registrarPago = async (req, res) => {
  const { id: ordenCompraId } = req.params;

  const rawTipo = (req.body?.tipo_pago ?? '').toString().trim().toUpperCase();
  const tipoCanonico =
    ['TOTAL', 'PAGO_TOTAL'].includes(rawTipo) ? 'TOTAL' :
    ['ANTICIPO', 'PARCIAL', 'ABONO', 'PAGO_PARCIAL'].includes(rawTipo) ? 'ANTICIPO' :
    null;

  if (!tipoCanonico) {
    return res.status(400).json({ error: `tipo_pago inválido (${rawTipo}). Usa TOTAL o ANTICIPO.` });
  }

  const montoRaw = (req.body?.monto ?? '').toString().replace(',', '.');
  const comentario = req.body?.comentario;
  const archivo = req.file;
  const usuarioId = req.usuarioSira?.id;

  const fuentePagoId = Number(req.body?.fuente_pago_id);
  if (!Number.isInteger(fuentePagoId) || fuentePagoId <= 0) {
    return res.status(400).json({ error: 'fuente_pago_id es obligatorio y debe ser numérico.' });
  }

  const fechaCompromiso = parseFechaYYYYMMDD(req.body?.fecha_compromiso_pago);
  if (tipoCanonico === 'ANTICIPO' && !fechaCompromiso) {
    return res.status(400).json({ error: 'fecha_compromiso_pago es obligatoria para ANTICIPO (YYYY-MM-DD).' });
  }

  try {
    if (!archivo) return res.status(400).json({ error: 'No se envió el comprobante.' });
    if (!usuarioId) return res.status(401).json({ error: 'Usuario no autenticado para registrar pagos.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ocBefore = await getOcInfo(ordenCompraId, client, true);
      const { numero_oc, metodo_pago, status, proveedor_nombre } = ocBefore;

      const pagadoAntes = Number(ocBefore.monto_pagado || 0);
      const totalNum = Number(ocBefore.total || 0);
      const saldo = Math.max(0, totalNum - pagadoAntes);

      // Validaciones de monto
      let montoAplicar = Number(montoRaw);
      if (tipoCanonico === 'ANTICIPO') {
        if (!(montoAplicar > 0)) return res.status(400).json({ error: 'Monto requerido para ANTICIPO.' });
      } else {
        if (!(montoAplicar > 0)) {
          if (saldo <= 0) return res.status(400).json({ error: 'La OC ya está liquidada.' });
          montoAplicar = saldo;
        }
      }
      if (montoAplicar > saldo) montoAplicar = saldo;

      // Validar fuente_pago_id existe y está activa
      const fpQ = await client.query(`SELECT id, activo FROM catalogo_fuentes_pago WHERE id = $1`, [fuentePagoId]);
      if (fpQ.rowCount === 0) return res.status(400).json({ error: 'fuente_pago_id no existe.' });
      if (!fpQ.rows[0].activo) return res.status(409).json({ error: 'La fuente de pago está inactiva.' });

      // Subir comprobante
      const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const guessedPdf = (archivo.mimetype || '').includes('pdf');
      const extFromName = path.extname(archivo.originalname || '');
      const ext = extFromName || (guessedPdf ? '.pdf' : '');
      const safeMonto = Number(montoAplicar).toFixed(2).replace('.', '_');
      const fileName = `COMPROBANTE_PAGO_${numero_oc}_${ts}_${safeMonto}${ext}`;

      const driveFile = await uploadOcPaymentReceipt(
        archivo,
        ocBefore.depto_codigo,
        ocBefore.numero_requisicion,
        numero_oc,
        fileName
      );
      if (!driveFile || !driveFile.webViewLink) throw new Error('Falló la subida del comprobante a Drive.');

      // Insert pago (ledger)
      const pagoQ = await client.query(`
        INSERT INTO pagos_oc
          (orden_compra_id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario, fuente_pago_id, fecha_compromiso_pago)
        VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario, fuente_pago_id, fecha_compromiso_pago
      `, [ordenCompraId, montoAplicar, tipoCanonico, usuarioId, driveFile.webViewLink, comentario || null, fuentePagoId, fechaCompromiso]);

      const pago = pagoQ.rows[0];

      // Si es SPEI y estaba en CONFIRMAR_SPEI => APROBADA + guardar comprobante principal en OC
      let nuevoStatus = status;
      let setComprobanteEnOC = false;

      if (metodo_pago === 'SPEI') {
        nuevoStatus = 'APROBADA';
        if (status === 'CONFIRMAR_SPEI') setComprobanteEnOC = true;
      }

      // Actualizar OC sin tocar monto_pagado (lo recalcula el trigger)
      // - ANTICIPO: guardamos fecha_compromiso como próxima fecha comprometida
      // - TOTAL: limpiamos fecha_vencimiento_pago
      const nuevaFechaVenc = tipoCanonico === 'ANTICIPO' ? fechaCompromiso : null;

      if (setComprobanteEnOC) {
        await client.query(`
          UPDATE ordenes_compra
          SET status = $1,
              comprobante_pago_link = $2,
              fecha_vencimiento_pago = $3,
              actualizado_en = now()
          WHERE id = $4
        `, [nuevoStatus, driveFile.webViewLink, nuevaFechaVenc, ordenCompraId]);
      } else {
        await client.query(`
          UPDATE ordenes_compra
          SET status = $1,
              fecha_vencimiento_pago = $2,
              actualizado_en = now()
          WHERE id = $3
        `, [nuevoStatus, nuevaFechaVenc, ordenCompraId]);
      }

      // Historial
      await client.query(`
        INSERT INTO ordenes_compra_historial
          (orden_compra_id, usuario_id, accion_realizada, detalles)
        VALUES ($1, $2, $3, $4)
      `, [ordenCompraId, usuarioId, 'REGISTRO DE PAGO',
        JSON.stringify({
          tipo_pago: tipoCanonico,
          monto: montoAplicar,
          fuente_pago_id: fuentePagoId,
          fecha_compromiso_pago: fechaCompromiso,
          comprobante: driveFile.webViewLink,
          comentario
        })]);

      // Leer OC final (ya con trigger aplicado)
      const ocAfterQ = await client.query(`
        SELECT id, numero_oc, status, metodo_pago, total, monto_pagado, pendiente_liquidar, estatus_pago, fecha_vencimiento_pago, comprobante_pago_link
        FROM ordenes_compra
        WHERE id = $1
      `, [ordenCompraId]);
      const ocAfter = ocAfterQ.rows[0];

      await client.query('COMMIT');

      // Email (solo caso SPEI aprobado)
      if (metodo_pago === 'SPEI' && ocAfter.status === 'APROBADA') {
        let folderLink;
        try {
          const info = await getOcFolderWebLink(ocBefore.depto_codigo, ocBefore.numero_requisicion, numero_oc);
          folderLink = info?.webViewLink || null;
        } catch { folderLink = null; }
        if (!folderLink) folderLink = driveFile.webViewLink;

        const recipients = await getNotificationEmails('OC_APROBADA', pool);
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

/** ===============================
 *  POST /api/finanzas/oc/:id/pagos/:pagoId/reversar
 *  form-data:
 *   - comprobante (file) obligatorio
 *   - monto (opcional) -> si no viene, reversa total disponible
 *   - comentario (obligatorio)
 *   - fuente_pago_id (requerido)
 * =============================== */
const reversarPago = async (req, res) => {
  const { id: ordenCompraId, pagoId } = req.params;
  const usuarioId = req.usuarioSira?.id;

  const archivo = req.file;
  const comentario = (req.body?.comentario ?? '').toString().trim();
  const montoRaw = (req.body?.monto ?? '').toString().replace(',', '.');
  const fuentePagoId = Number(req.body?.fuente_pago_id);

  if (!usuarioId) return res.status(401).json({ error: 'Usuario no autenticado.' });
  if (!archivo) return res.status(400).json({ error: 'Debes subir el comprobante de devolución/reversa.' });
  if (!comentario) return res.status(400).json({ error: 'El comentario/motivo es obligatorio.' });
  if (!Number.isInteger(fuentePagoId) || fuentePagoId <= 0) return res.status(400).json({ error: 'fuente_pago_id es obligatorio y debe ser numérico.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocBefore = await getOcInfo(ordenCompraId, client, true);

    // Validar fuente pago activa
    const fpQ = await client.query(`SELECT id, activo FROM catalogo_fuentes_pago WHERE id = $1`, [fuentePagoId]);
    if (fpQ.rowCount === 0) return res.status(400).json({ error: 'fuente_pago_id no existe.' });
    if (!fpQ.rows[0].activo) return res.status(409).json({ error: 'La fuente de pago está inactiva.' });

    // Pago original (debe pertenecer a la OC y NO ser reversa)
    const pagoOrigQ = await client.query(`
      SELECT id, monto, tipo_pago, comprobante_link
      FROM pagos_oc
      WHERE id = $1 AND orden_compra_id = $2
      FOR UPDATE
    `, [pagoId, ordenCompraId]);

    if (pagoOrigQ.rowCount === 0) return res.status(404).json({ error: 'Pago original no encontrado para esta OC.' });

    const pagoOrig = pagoOrigQ.rows[0];
    if (pagoOrig.tipo_pago === 'REVERSA') {
      return res.status(409).json({ error: 'No puedes reversar un movimiento que ya es REVERSA.' });
    }

    const montoOriginal = Number(pagoOrig.monto || 0);
    if (!(montoOriginal > 0)) return res.status(409).json({ error: 'El pago original no es reversible (monto inválido).' });

    // Calcular reversas ya aplicadas a este pago
    const revSumQ = await client.query(`
      SELECT COALESCE(SUM(ABS(monto)),0) AS reversado
      FROM pagos_oc
      WHERE reversa_de_pago_id = $1
    `, [pagoId]);

    const reversado = Number(revSumQ.rows[0].reversado || 0);
    const disponible = Math.max(0, montoOriginal - reversado);
    if (disponible <= 0) return res.status(409).json({ error: 'Este pago ya fue reversado completamente.' });

    // Monto a reversar
    let montoReversa = Number(montoRaw);
    if (!(montoReversa > 0)) montoReversa = disponible;
    if (montoReversa > disponible) montoReversa = disponible;

    // Subir comprobante
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const guessedPdf = (archivo.mimetype || '').includes('pdf');
    const extFromName = path.extname(archivo.originalname || '');
    const ext = extFromName || (guessedPdf ? '.pdf' : '');
    const safeMonto = Number(montoReversa).toFixed(2).replace('.', '_');
    const fileName = `COMPROBANTE_REVERSA_${ocBefore.numero_oc}_${ts}_${safeMonto}${ext}`;

    const driveFile = await uploadOcPaymentReceipt(
      archivo,
      ocBefore.depto_codigo,
      ocBefore.numero_requisicion,
      ocBefore.numero_oc,
      fileName
    );
    if (!driveFile?.webViewLink) throw new Error('Falló la subida del comprobante de reversa a Drive.');

    // Insert reversa (monto NEGATIVO)
    const revQ = await client.query(`
      INSERT INTO pagos_oc
        (orden_compra_id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario, fuente_pago_id, reversa_de_pago_id)
      VALUES ($1, now(), $2, 'REVERSA', $3, $4, $5, $6, $7)
      RETURNING id, fecha_pago, monto, tipo_pago, usuario_id, comprobante_link, comentario, fuente_pago_id, reversa_de_pago_id
    `, [ordenCompraId, -montoReversa, usuarioId, driveFile.webViewLink, comentario, fuentePagoId, pagoId]);

    // Historial OC
    await client.query(`
      INSERT INTO ordenes_compra_historial
        (orden_compra_id, usuario_id, accion_realizada, detalles)
      VALUES ($1, $2, $3, $4)
    `, [ordenCompraId, usuarioId, 'REVERSA DE PAGO',
      JSON.stringify({
        pago_original_id: pagoId,
        monto_reversa: montoReversa,
        fuente_pago_id: fuentePagoId,
        comprobante: driveFile.webViewLink,
        comentario
      })]);

    // Leer OC final (trigger recalcula)
    const ocAfterQ = await client.query(`
      SELECT id, numero_oc, status, metodo_pago, total, monto_pagado, pendiente_liquidar, estatus_pago, fecha_vencimiento_pago
      FROM ordenes_compra
      WHERE id = $1
    `, [ordenCompraId]);
    const ocAfter = ocAfterQ.rows[0];

    await client.query('COMMIT');
    return res.status(201).json({ mensaje: 'Reversa registrada', reversa: revQ.rows[0], oc: ocAfter });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al reversar pago:', err);
    return res.status(500).json({ error: err.message || 'Error al reversar pago.' });
  } finally {
    client.release();
  }
};

module.exports = { listarPagos, registrarPago, reversarPago };
