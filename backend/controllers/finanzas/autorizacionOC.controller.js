// C:\SIRA\backend\controllers\finanzas\autorizacionOC.controller.js
const pool = require('../../db/pool');

/** =========================
 *  LISTA: POR AUTORIZAR
 * ========================== */
const getOcsPorAutorizar = async (_req, res) => {
  try {
    const q = `
      SELECT 
        oc.id, oc.numero_oc, oc.total, oc.fecha_creacion, oc.status, oc.metodo_pago,
        oc.monto_pagado,
        p.razon_social AS proveedor_razon_social,
        pr.nombre AS proyecto_nombre,
        s.nombre AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos  pr ON oc.proyecto_id = pr.id
      JOIN sitios     s  ON oc.sitio_id = s.id
      WHERE oc.status = 'POR_AUTORIZAR'
      ORDER BY oc.fecha_creacion ASC
    `;
    const { rows } = await pool.query(q);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener OCs por autorizar:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/** =========================
 *  SPEI: POR CONFIRMAR
 * ========================== */
const listSpeiPorConfirmar = async (_req, res) => {
  try {
    const q = `
      SELECT 
        oc.id, oc.numero_oc, oc.total, oc.fecha_creacion, oc.status, oc.metodo_pago,
        oc.monto_pagado,
        p.razon_social AS proveedor_razon_social,
        pr.nombre AS proyecto_nombre,
        s.nombre AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos  pr ON oc.proyecto_id = pr.id
      JOIN sitios     s  ON oc.sitio_id = s.id
      WHERE oc.metodo_pago = 'SPEI'
        AND oc.status = 'CONFIRMAR_SPEI'
      ORDER BY oc.fecha_creacion ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar SPEI por confirmar:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/** =========================
 *  POR LIQUIDAR (CxP)
 *  Regla: saldo > 0 (independiente del status operativo)
 *  oc.status es informativo; solo excluimos estados que NO deben estar en CxP
 * ========================== */
const listOcsPorLiquidar = async (_req, res) => {
  try {
    const q = `
      SELECT 
        oc.id, oc.numero_oc, oc.total,
        COALESCE(oc.monto_pagado, 0) AS monto_pagado,
        (oc.total - COALESCE(oc.monto_pagado, 0)) AS saldo_pendiente,
        oc.fecha_vencimiento_pago,
        oc.status,
        oc.metodo_pago,
        oc.estatus_pago,
        oc.pendiente_liquidar,
        p.razon_social AS proveedor_razon_social,
        pr.nombre AS proyecto_nombre,
        s.nombre AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos  pr ON oc.proyecto_id = pr.id
      JOIN sitios     s  ON oc.sitio_id = s.id
      WHERE (oc.total - COALESCE(oc.monto_pagado, 0)) > 0
        AND oc.status NOT IN ('POR_AUTORIZAR','RECHAZADA','CANCELADA','HOLD','CONFIRMAR_SPEI')
      ORDER BY oc.fecha_vencimiento_pago NULLS LAST, oc.fecha_creacion ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (error) {
    console.error("Error al listar OCs por liquidar:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/** =========================
 *  EN HOLD
 * ========================== */
const listOcsEnHold = async (_req, res) => {
  try {
    const q = `
      SELECT 
        oc.id, oc.numero_oc, oc.total, oc.status, oc.hold_regresar_en,
        p.razon_social AS proveedor_razon_social,
        pr.nombre AS proyecto_nombre,
        s.nombre AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos  pr ON oc.proyecto_id = pr.id
      JOIN sitios     s  ON oc.sitio_id = s.id
      WHERE oc.status = 'HOLD'
      ORDER BY oc.hold_regresar_en NULLS LAST, oc.fecha_creacion ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar OCs en HOLD:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/** =========================
 *  PRE-AUTORIZAR SPEI
 * ========================== */
const preautorizarSpei = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocQuery = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });

    const currentStatus = ocQuery.rows[0].status;
    if (currentStatus !== 'POR_AUTORIZAR') {
      return res.status(409).json({ error: `La OC está en estado '${currentStatus}' y no puede pasar a SPEI.` });
    }

    const updateResult = await client.query(
      `UPDATE ordenes_compra
       SET status = 'CONFIRMAR_SPEI', metodo_pago = 'SPEI', actualizado_en = now()
       WHERE id = $1
       RETURNING id, status, metodo_pago`,
      [ordenCompraId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'PRE-AUTORIZACIÓN SPEI', JSON.stringify({ anterior: 'POR_AUTORIZAR', nuevo: 'CONFIRMAR_SPEI' })]
    );

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'OC marcada SPEI (pendiente de comprobante).', ordenCompra: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al pre-autorizar SPEI:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  CANCELAR PRE-AUTORIZACIÓN SPEI
 * ========================== */
const cancelarSpei = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocQuery = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });

    const currentStatus = ocQuery.rows[0].status;
    if (currentStatus !== 'CONFIRMAR_SPEI') {
      return res.status(409).json({ error: `Solo se puede cancelar cuando la OC está en CONFIRMAR_SPEI. (Actual: ${currentStatus})` });
    }

    const upd = await client.query(
      `UPDATE ordenes_compra
       SET status = 'POR_AUTORIZAR', metodo_pago = NULL, actualizado_en = now()
       WHERE id = $1
       RETURNING id, status, metodo_pago`,
      [ordenCompraId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'CANCELACIÓN PRE-AUTORIZACIÓN SPEI', JSON.stringify({ anterior: 'CONFIRMAR_SPEI', nuevo: 'POR_AUTORIZAR' })]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Pre-autorización SPEI cancelada.', ordenCompra: upd.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar SPEI:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  APROBAR A CRÉDITO
 * ========================== */
const aprobarCredito = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocQuery = await client.query(
      `SELECT oc.*, p.dias_credito 
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       WHERE oc.id = $1 FOR UPDATE`,
      [ordenCompraId]
    );
   
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });

    const ocData = ocQuery.rows[0];
    if (ocData.status !== 'POR_AUTORIZAR') {
      return res.status(409).json({ error: `La OC ya está en estado '${ocData.status}'.` });
    }

    const diasCredito = ocData.dias_credito || 30;
    const fechaVencimiento = new Date(); fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);

    const updateQuery = await client.query(
      `UPDATE ordenes_compra
       SET status = 'APROBADA', metodo_pago = 'CREDITO', fecha_vencimiento_pago = $1, actualizado_en = now()
       WHERE id = $2
       RETURNING id, status, fecha_vencimiento_pago`,
      [fechaVencimiento, ordenCompraId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'APROBACIÓN A CRÉDITO', JSON.stringify({ fecha_vencimiento_pago: fechaVencimiento.toISOString().split('T')[0] })]
    );

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'OC aprobada a crédito.', ordenCompra: updateQuery.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al aprobar OC a crédito:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  DETALLES DE CRÉDITO
 * ========================== */
const getDetallesCredito = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.dias_credito
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       WHERE oc.id = $1`,
      [ordenCompraId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener detalles de crédito:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/** =========================
 *  RECHAZAR OC
 * ========================== */
const rechazarOC = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { motivo } = req.body || {};
  const { id: usuarioId } = req.usuarioSira;
  if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'El motivo es obligatorio.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
    if (q.rows[0].status !== 'POR_AUTORIZAR' && q.rows[0].status !== 'HOLD') {
      return res.status(409).json({ error: 'Solo puedes rechazar OCs en POR_AUTORIZAR u HOLD.' });
    }

    const upd = await client.query(
      `UPDATE ordenes_compra SET status = 'RECHAZADA', actualizado_en = now() WHERE id = $1 RETURNING id, status`,
      [ordenCompraId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'RECHAZO', JSON.stringify({ motivo })]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'OC rechazada.', ordenCompra: upd.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al rechazar OC:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  PONER EN HOLD OC
 *  (default +30 días si no se envía fecha)
 * ========================== */
const ponerHoldOC = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  let { regresar_en } = req.body || {}; // 'YYYY-MM-DD' opcional
  const { id: usuarioId } = req.usuarioSira;

  // default +30 días
  if (!regresar_en) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    regresar_en = d.toISOString().slice(0, 10);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
    if (q.rows[0].status !== 'POR_AUTORIZAR') return res.status(409).json({ error: 'Solo puedes poner en hold OCs en POR_AUTORIZAR.' });

    const upd = await client.query(
      `UPDATE ordenes_compra 
       SET status = 'HOLD', hold_regresar_en = $2, actualizado_en = now()
       WHERE id = $1 RETURNING id, status, hold_regresar_en`,
      [ordenCompraId, regresar_en]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'PONER EN HOLD', JSON.stringify({ regresar_en })]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'OC puesta en hold.', ordenCompra: upd.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al poner OC en hold:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  REANUDAR DESDE HOLD
 * ========================== */
const reanudarDesdeHold = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
    if (q.rows[0].status !== 'HOLD') return res.status(409).json({ error: 'Solo puedes reanudar OCs en HOLD.' });

    const upd = await client.query(
      `UPDATE ordenes_compra 
       SET status = 'POR_AUTORIZAR', hold_regresar_en = NULL, actualizado_en = now()
       WHERE id = $1 RETURNING id, status`,
      [ordenCompraId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'REANUDAR DESDE HOLD', JSON.stringify({ nuevo: 'POR_AUTORIZAR' })]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'OC reanudada.', ordenCompra: upd.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al reanudar OC:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  CANCELAR OC (NUEVO)
 *  - Cambia status a CANCELADA
 *  - Reversa cantidades procesadas en requisiciones_detalle
 *  - Recalcula status_compra por cada requisicion_detalle afectado
 *
 * Regla:
 * - NO se permite cancelar si la OC está ENTREGADA
 * - Si ya estaba cancelada, responde 409
 * ========================== */
const cancelarOC = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { motivo } = req.body || {};
  const { id: usuarioId } = req.usuarioSira;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Lock OC
    const ocQ = await client.query(
      `SELECT id, status, rfq_id
       FROM ordenes_compra
       WHERE id = $1
       FOR UPDATE`,
      [ordenCompraId]
    );

    if (ocQ.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'OC no encontrada.' });
    }

    const oc = ocQ.rows[0];

    if (oc.status === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La OC ya está CANCELADA.' });
    }

    if (oc.status === 'ENTREGADA') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede cancelar una OC ENTREGADA.' });
    }

    // 2) Obtener detalle OC (para revertir cantidades)
    const detQ = await client.query(
      `SELECT id, requisicion_detalle_id, cantidad
       FROM ordenes_compra_detalle
       WHERE orden_compra_id = $1`,
      [ordenCompraId]
    );

    // 3) Marcar OC como CANCELADA
    const updOc = await client.query(
      `UPDATE ordenes_compra
       SET status = 'CANCELADA', actualizado_en = now()
       WHERE id = $1
       RETURNING id, status`,
      [ordenCompraId]
    );

    // 4) Revertir cantidades en requisiciones_detalle (si aplica)
    // Nota: mantenemos ordenes_compra_detalle para auditoría, solo revertimos el efecto en requisición.
    const affectedRdIds = new Set();

    for (const row of detQ.rows) {
      const rdId = row.requisicion_detalle_id;
      const qty = Number(row.cantidad || 0);
      if (!rdId || qty <= 0) continue;

      affectedRdIds.add(rdId);

      // Restar y no permitir negativos
      await client.query(
        `
        UPDATE requisiciones_detalle
        SET cantidad_procesada = GREATEST(COALESCE(cantidad_procesada, 0) - $1, 0)
        WHERE id = $2
        `,
        [qty, rdId]
      );
    }

    // 5) Recalcular status_compra por cada requisicion_detalle afectado
    //    - Si con la nueva cantidad_procesada ya no cumple la cantidad -> PENDIENTE
    //    - Si aún cumple, dejar status_compra como el último OC no cancelado que tenga esa línea (si existe)
    for (const rdId of affectedRdIds) {
      const rdQ = await client.query(
        `SELECT id, cantidad, COALESCE(cantidad_procesada, 0) AS cantidad_procesada
         FROM requisiciones_detalle
         WHERE id = $1`,
        [rdId]
      );

      if (rdQ.rowCount === 0) continue;
      const rd = rdQ.rows[0];

      const cumple = Number(rd.cantidad_procesada) >= Number(rd.cantidad || 0);

      if (!cumple) {
        await client.query(
          `UPDATE requisiciones_detalle
           SET status_compra = 'PENDIENTE'
           WHERE id = $1`,
          [rdId]
        );
      } else {
        // Buscar alguna OC no cancelada relacionada con esta línea
        const lastOcQ = await client.query(
          `
          SELECT oc.id
          FROM ordenes_compra_detalle ocd
          JOIN ordenes_compra oc ON oc.id = ocd.orden_compra_id
          WHERE ocd.requisicion_detalle_id = $1
            AND oc.status <> 'CANCELADA'
          ORDER BY oc.id DESC
          LIMIT 1
          `,
          [rdId]
        );

        if (lastOcQ.rowCount > 0) {
          await client.query(
            `UPDATE requisiciones_detalle
             SET status_compra = $2
             WHERE id = $1`,
            [rdId, String(lastOcQ.rows[0].id)]
          );
        } else {
          await client.query(
            `UPDATE requisiciones_detalle
             SET status_compra = 'PENDIENTE'
             WHERE id = $1`,
            [rdId]
          );
        }
      }
    }

    // 6) Historial
    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [
        ordenCompraId,
        usuarioId,
        'CANCELACIÓN OC',
        JSON.stringify({
          motivo: motivo ? String(motivo).trim() : null,
          rfq_id: oc.rfq_id ?? null
        })
      ]
    );

    await client.query('COMMIT');

    res.status(200).json({
      mensaje: 'OC cancelada correctamente. Si existían opciones seleccionadas pendientes, el RFQ volverá a aparecer en VB_RFQ.',
      ordenCompra: updOc.rows[0],
      requisicion_detalle_afectado: Array.from(affectedRdIds),
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar OC:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/** =========================
 *  PREVIEW OC (encabezado + detalle)
 * ========================== */
const getOcPreview = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const encQ = await pool.query(`
      SELECT 
        oc.id,
        oc.numero_oc,
        oc.total,
        oc.status,
        oc.metodo_pago,
        oc.fecha_creacion,
        p.razon_social AS proveedor_nombre,
        pr.nombre       AS proyecto_nombre,
        s.nombre        AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON p.id = oc.proveedor_id
      JOIN proyectos  pr ON pr.id = oc.proyecto_id
      JOIN sitios     s  ON s.id = oc.sitio_id
      WHERE oc.id = $1
    `, [ordenCompraId]);

    if (encQ.rowCount === 0) {
      return res.status(404).json({ error: 'OC no encontrada.' });
    }

    const detQ = await pool.query(`
      SELECT 
        d.id,
        d.material_id,
        d.cantidad,
        d.precio_unitario,
        d.moneda,
        (d.cantidad * d.precio_unitario) AS total_linea,
        cm.nombre AS material_nombre
      FROM ordenes_compra_detalle d
      LEFT JOIN catalogo_materiales cm ON cm.id = d.material_id
      WHERE d.orden_compra_id = $1
      ORDER BY d.id ASC
    `, [ordenCompraId]);

    res.json({
      encabezado: encQ.rows[0],
      detalle: detQ.rows,
    });
  } catch (error) {
    console.error('Error al obtener preview OC:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getOcsPorAutorizar,
  listSpeiPorConfirmar,
  listOcsPorLiquidar,
  listOcsEnHold,
  preautorizarSpei,
  cancelarSpei,
  aprobarCredito,
  getDetallesCredito,
  rechazarOC,
  ponerHoldOC,
  reanudarDesdeHold,
  cancelarOC, // ✅ NUEVO
  getOcPreview,
};
