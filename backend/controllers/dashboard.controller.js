const pool = require('../db/pool');
const { getRecent: getRecentNotifications } = require('../services/notificationStore');

/* =========================================================================
   UTILIDADES: ENUMS DINÁMICOS DE POSTGRESQL
   ========================================================================= */

// Obtiene el ENUM de OC de la BD, cachea en memoria
let OC_ENUM_CACHE = null;
let RFQ_ENUM_CACHE = null;

async function getOCStatusEnum() {
  if (!OC_ENUM_CACHE) {
    const result = await pool.query(
      `SELECT unnest(enum_range(NULL::orden_compra_status)) as value;`
    );
    OC_ENUM_CACHE = result.rows.map(r => r.value);
  }
  return OC_ENUM_CACHE;
}

async function getRFQStatusEnum() {
  if (!RFQ_ENUM_CACHE) {
    const result = await pool.query(
      `SELECT unnest(enum_range(NULL::requisicion_status)) as value;`
    );
    RFQ_ENUM_CACHE = result.rows.map(r => r.value);
  }
  return RFQ_ENUM_CACHE;
}

function filterValidStatus(input, validList) {
  if (!input) return null;
  if (input.includes(',')) {
    const arr = input.split(',').map(s => s.trim()).filter(Boolean);
    const filtrado = arr.filter(s => validList.includes(s));
    return filtrado.length > 0 ? filtrado : null;
  }
  return validList.includes(input) ? input : null;
}

/* =========================================================================
   ENDPOINTS
   ========================================================================= */

// Endpoint para exponer los enums válidos al frontend
const getStatusOptions = async (req, res) => {
  try {
    const ocStatus = await getOCStatusEnum();
    const rfqStatus = await getRFQStatusEnum();
    res.json({ ocStatus, rfqStatus });
  } catch (error) {
    console.error("Error al obtener enums:", error);
    res.status(500).json({ error: "Error al obtener enums de status." });
  }
};

/**
 * Devuelve los departamentos que tienen al menos una RFQ.
 */
const getDepartamentosConRfq = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        d.id,
        d.nombre,
        d.codigo
      FROM departamentos d
      JOIN requisiciones r ON d.id = r.departamento_id
      WHERE r.rfq_code IS NOT NULL
      ORDER BY d.nombre;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener departamentos con RFQ:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Dashboard principal de compras (SSD): filtra por status válidos dinámicos, departamento, sitio y proyecto.
 */
const getComprasDashboard = async (req, res) => {
  try {
    const { rfq_status, oc_status, departamento_id, sitio_id, proyecto_id } = req.query;

    // Trae los enums válidos en caliente
    const validRfqStatus = await getRFQStatusEnum();
    const validOcStatus = await getOCStatusEnum();

    // Limpia los filtros usando los enums
    const safeRfqStatus = filterValidStatus(rfq_status, validRfqStatus);
    const safeOcStatus = filterValidStatus(oc_status, validOcStatus);

    // Query principal, ahora incluye los IDs de sitio y proyecto para filtrado eficiente
    let query = `
      WITH rfq_base AS (
        SELECT
          r.id as rfq_id,
          r.rfq_code,
          s.nombre as sitio,
          s.id as sitio_id,
          p.nombre as proyecto,
          p.id as proyecto_id,
          r.status as rfq_status,
          r.departamento_id,
          d.nombre as departamento_nombre,
          u.nombre as usuario_creador
        FROM requisiciones r
        JOIN sitios s ON r.sitio_id = s.id
        JOIN proyectos p ON r.proyecto_id = p.id
        LEFT JOIN departamentos d ON r.departamento_id = d.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE r.rfq_code IS NOT NULL
      )
      SELECT
        rb.rfq_id,
        rb.rfq_code,
        rb.sitio,
        rb.sitio_id,
        rb.proyecto,
        rb.proyecto_id,
        rb.rfq_status,
        rb.departamento_id,
        rb.departamento_nombre,
        rb.usuario_creador,
        oc.id as oc_id,
        oc.numero_oc,
        oc.status as oc_status,
        prov.razon_social as proveedor_nombre
      FROM rfq_base rb
      LEFT JOIN ordenes_compra oc ON rb.rfq_id = oc.rfq_id
      LEFT JOIN proveedores prov ON oc.proveedor_id = prov.id
    `;

    const conditions = [];
    const values = [];

    if (safeRfqStatus) {
      if (Array.isArray(safeRfqStatus)) {
        values.push(safeRfqStatus);
        conditions.push(`rb.rfq_status = ANY($${values.length}::requisicion_status[])`);
      } else {
        values.push(safeRfqStatus);
        conditions.push(`rb.rfq_status = $${values.length}`);
      }
    }

    if (safeOcStatus) {
      if (Array.isArray(safeOcStatus)) {
        values.push(safeOcStatus);
        conditions.push(`oc.status = ANY($${values.length}::orden_compra_status[])`);
      } else {
        values.push(safeOcStatus);
        conditions.push(`oc.status = $${values.length}`);
      }
    }

    if (departamento_id) {
      values.push(departamento_id);
      conditions.push(`rb.departamento_id = $${values.length}`);
    }

    if (sitio_id) {
      values.push(sitio_id);
      conditions.push(`rb.sitio_id = $${values.length}`);
    }

    if (proyecto_id) {
      values.push(proyecto_id);
      conditions.push(`rb.proyecto_id = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY rb.rfq_id DESC;`;

    const { rows } = await pool.query(query, values);

    // Agrupa por RFQ
    const resultadoAgrupado = rows.reduce((acc, row) => {
      if (!acc[row.rfq_id]) {
        acc[row.rfq_id] = {
          rfq_id: row.rfq_id,
          rfq_code: row.rfq_code,
          sitio: row.sitio,
          sitio_id: row.sitio_id,
          proyecto: row.proyecto,
          proyecto_id: row.proyecto_id,
          rfq_status: row.rfq_status,
          departamento_id: row.departamento_id,
          departamento_nombre: row.departamento_nombre || null,
          usuario_creador: row.usuario_creador || null,
          ordenes: []
        };
      }
      if (row.numero_oc) {
        acc[row.rfq_id].ordenes.push({
          id: row.oc_id,
          numero_oc: row.numero_oc,
          oc_status: row.oc_status,
          proveedor_nombre: row.proveedor_nombre || null,
        });
      }
      return acc;
    }, {});

    res.json(Object.values(resultadoAgrupado));

  } catch (error) {
    console.error("Error al obtener datos del dashboard de compras:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * PATCH /api/dashboard/requisicion/:id/status
 * Permite cambiar manualmente el status de una requisición desde el dashboard SSD.
 */
const updateRequisicionStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'Se requiere id y status.' });
  }

  try {
    const validStatuses = await getRFQStatusEnum();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status inválido: '${status}'. Valores permitidos: ${validStatuses.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE requisiciones SET status = $1, actualizado_en = NOW() WHERE id = $2 RETURNING id, status`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Requisición no encontrada.' });
    }

    res.json({ mensaje: `Status actualizado a '${status}'.`, requisicion: result.rows[0] });
  } catch (error) {
    console.error(`Error al actualizar status de requisición ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * GET /api/dashboard/analytics
 * KPIs globales para el modal de TV del dashboard SSD.
 */
const getAnalyticsDashboard = async (req, res) => {
  try {
    // 1) RFQ activas
    const rfqQ = await pool.query(`
      SELECT COUNT(*)::int AS rfq_activas
      FROM requisiciones
      WHERE rfq_code IS NOT NULL
        AND status NOT IN ('ENTREGADA', 'CANCELADA')
    `);

    // 2) OC por status relevante
    const ocQ = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'POR_AUTORIZAR')::int  AS oc_por_autorizar,
        COUNT(*) FILTER (WHERE status = 'CONFIRMAR_SPEI')::int AS oc_confirmar_spei,
        COUNT(*) FILTER (WHERE status = 'APROBADA')::int       AS oc_por_recolectar,
        COUNT(*) FILTER (WHERE status = 'EN_PROCESO')::int     AS oc_en_proceso
      FROM ordenes_compra
      WHERE status NOT IN ('CANCELADA', 'RECHAZADA')
    `);

    // 3) Tiempo promedio en días (creación → actualización de OCs fuera del estado inicial)
    let dias_promedio_oc = null;
    try {
      const tpQ = await pool.query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (actualizado_en - fecha_creacion)) / 86400.0))::int AS dias
        FROM ordenes_compra
        WHERE status NOT IN ('POR_AUTORIZAR', 'CANCELADA', 'RECHAZADA', 'CONFIRMAR_SPEI')
          AND fecha_creacion IS NOT NULL
          AND actualizado_en IS NOT NULL
          AND actualizado_en > fecha_creacion
      `);
      dias_promedio_oc = tpQ.rows[0]?.dias ?? null;
    } catch (_) {
      // creado_en may not exist on this DB; graceful fallback
    }

    // 4) Proyectos EN_EJECUCION con gasto por moneda
    const proyectosQ = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.status,
        s.nombre AS sitio_nombre,
        u.nombre AS responsable_nombre
      FROM proyectos p
      LEFT JOIN sitios s ON p.sitio_id = s.id
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      WHERE p.activo = true
        AND p.status = 'EN_EJECUCION'
        AND (s.nombre IS NULL OR UPPER(TRIM(s.nombre)) <> 'UNIDADES')
      ORDER BY p.nombre ASC
    `);

    const gastoQ = await pool.query(`
      SELECT
        oc.proyecto_id,
        ocd.moneda,
        SUM(ocd.cantidad * ocd.precio_unitario)::numeric AS total
      FROM ordenes_compra oc
      JOIN ordenes_compra_detalle ocd ON ocd.orden_compra_id = oc.id
      WHERE oc.status IN ('APROBADA', 'EN_PROCESO', 'ENTREGADA')
        AND oc.proyecto_id IS NOT NULL
      GROUP BY oc.proyecto_id, ocd.moneda
    `);

    const gastoMap = {};
    gastoQ.rows.forEach(({ proyecto_id, moneda, total }) => {
      if (!gastoMap[proyecto_id]) gastoMap[proyecto_id] = [];
      gastoMap[proyecto_id].push({ moneda, total: Number(total) });
    });

    const proyectos = proyectosQ.rows.map((p) => ({
      ...p,
      gasto_por_moneda: gastoMap[p.id] || [],
    }));

    res.json({
      rfq_activas: rfqQ.rows[0]?.rfq_activas ?? 0,
      ...ocQ.rows[0],
      dias_promedio_oc,
      proyectos,
      generado_en: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[getAnalyticsDashboard]', error);
    res.status(500).json({ error: 'Error al generar analytics.' });
  }
};

/**
 * GET /api/dashboard/notificaciones
 * Devuelve las notificaciones del store en memoria (últimos 3 min).
 */
const getNotificaciones = (_req, res) => {
  res.json(getRecentNotifications());
};

module.exports = {
  getComprasDashboard,
  getDepartamentosConRfq,
  getStatusOptions,
  updateRequisicionStatus,
  getAnalyticsDashboard,
  getNotificaciones,
};
