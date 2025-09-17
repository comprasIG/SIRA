// C:\SIRA\backend\controllers\finanzas\autorizacionOC.controller.js

const pool = require('../../db/pool');
const { uploadPdfBuffer } = require('../../services/googleDrive');

/** =========================
 *  LISTA: POR AUTORIZAR
 * ========================== */
const getOcsPorAutorizar = async (req, res) => {
  try {
    const q = `
      SELECT 
        oc.id,
        oc.numero_oc,
        oc.total,
        oc.fecha_creacion,
        oc.status,
        oc.metodo_pago,
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
 *  (status = CONFIRMAR_SPEI)
 * ========================== */
const listSpeiPorConfirmar = async (req, res) => {
  try {
    const q = `
      SELECT 
        oc.id,
        oc.numero_oc,
        oc.total,
        oc.fecha_creacion,
        oc.status,
        oc.metodo_pago,
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
 *  POR LIQUIDAR
 *  - Crédito: APROBADA y monto_pagado < total
 *  - SPEI:   APROBADA y monto_pagado < total (pagos parciales)
 * ========================== */
const listOcsPorLiquidar = async (req, res) => {
  try {
    const q = `
      SELECT 
        oc.id,
        oc.numero_oc,
        oc.total,
        COALESCE(oc.monto_pagado, 0) AS monto_pagado,
        oc.fecha_vencimiento_pago,
        oc.status,
        oc.metodo_pago,
        p.razon_social AS proveedor_razon_social,
        pr.nombre AS proyecto_nombre,
        s.nombre AS sitio_nombre
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos  pr ON oc.proyecto_id = pr.id
      JOIN sitios     s  ON oc.sitio_id = s.id
      WHERE oc.status = 'APROBADA'
        AND COALESCE(oc.monto_pagado, 0) < oc.total
        AND (
          oc.metodo_pago = 'CREDITO'
          OR oc.metodo_pago = 'SPEI'
        )
      ORDER BY oc.fecha_vencimiento_pago NULLS LAST, oc.fecha_creacion ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar OCs por liquidar:', error);
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

    const ocQuery = await client.query(
      `SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`,
      [ordenCompraId]
    );
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'Orden de Compra no encontrada.' });

    const currentStatus = ocQuery.rows[0].status;
    if (currentStatus !== 'POR_AUTORIZAR') {
      return res.status(409).json({ error: `La OC ya se encuentra en estado '${currentStatus}' y no puede ser procesada.` });
    }

    const updateResult = await client.query(
      `UPDATE ordenes_compra
       SET status = 'CONFIRMAR_SPEI', metodo_pago = 'SPEI'
       WHERE id = $1
       RETURNING id, status, metodo_pago`,
      [ordenCompraId]
    );

    const detallesHistorial = {
      cambios: [
        { campo: 'status', anterior: 'POR_AUTORIZAR', nuevo: 'CONFIRMAR_SPEI' },
        { campo: 'metodo_pago', anterior: null, nuevo: 'SPEI' }
      ]
    };
    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'PRE-AUTORIZACIÓN SPEI', JSON.stringify(detallesHistorial)]
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
 *  Revierte a POR_AUTORIZAR
 * ========================== */
const cancelarSpei = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocQuery = await client.query(
      `SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`,
      [ordenCompraId]
    );
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'Orden de Compra no encontrada.' });

    const currentStatus = ocQuery.rows[0].status;
    if (currentStatus !== 'CONFIRMAR_SPEI') {
      return res.status(409).json({ error: `Solo se puede cancelar cuando la OC está en CONFIRMAR_SPEI. (Estado actual: ${currentStatus})` });
    }

    const upd = await client.query(
      `UPDATE ordenes_compra
       SET status = 'POR_AUTORIZAR', metodo_pago = NULL
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
 *  CONFIRMAR SPEI con comprobante (opcional si usas /pagos)
 *  (La lógica principal de pagos está en pagosOC.controller)
 * ========================== */
const confirmarSpeiConComprobante = async (req, res) => {
  // (dejamos tal cual tu versión si la sigues usando de forma directa)
  res.status(501).json({ error: 'Usa POST /api/finanzas/oc/:id/pagos para registrar el comprobante.' });
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
    if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'Orden de Compra no encontrada.' });

    const ocData = ocQuery.rows[0];
    if (ocData.status !== 'POR_AUTORIZAR') {
      return res.status(409).json({ error: `La OC ya se encuentra en estado '${ocData.status}'.` });
    }

    const diasCredito = ocData.dias_credito || 30;
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);

    const updateQuery = await client.query(
      `UPDATE ordenes_compra
       SET status = 'APROBADA', metodo_pago = 'CREDITO', fecha_vencimiento_pago = $1
       WHERE id = $2
       RETURNING id, status, fecha_vencimiento_pago`,
      [fechaVencimiento, ordenCompraId]
    );

    const detallesHistorial = {
      cambios: [
        { campo: 'status', anterior: 'POR_AUTORIZAR', nuevo: 'APROBADA' },
        { campo: 'metodo_pago', anterior: null, nuevo: 'CREDITO' },
        { campo: 'fecha_vencimiento_pago', anterior: null, nuevo: fechaVencimiento.toISOString().split('T')[0] }
      ],
      calculo_dias_credito: diasCredito
    };
    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ordenCompraId, usuarioId, 'APROBACIÓN A CRÉDITO', JSON.stringify(detallesHistorial)]
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

module.exports = {
  getOcsPorAutorizar,
  listSpeiPorConfirmar,
  listOcsPorLiquidar,
  preautorizarSpei,
  cancelarSpei,
  confirmarSpeiConComprobante,
  aprobarCredito,
  getDetallesCredito,
};
