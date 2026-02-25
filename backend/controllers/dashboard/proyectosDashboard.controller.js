// C:\SIRA\backend\controllers\dashboard\proyectosDashboard.controller.js
/**
 * ============================================================================
 * SIRA - Dashboard de Proyectos (Tab "Proyectos" en dashboards departamentales)
 * ----------------------------------------------------------------------------
 * Endpoints:
 *   GET   /api/dashboard/proyectos?departamento_id=X
 *   PATCH /api/dashboard/proyectos/:id/status
 * ============================================================================
 */

const pool = require('../../db/pool');

const ALLOWED_PROYECTO_STATUS = [
  'POR_APROBAR',
  'EN_EJECUCION',
  'EN_PAUSA',
  'CANCELADO',
  'CERRADO',
];

/**
 * GET /api/dashboard/proyectos
 *
 * Retorna proyectos activos con:
 *  - datos básicos (nombre, sitio, status, fechas, finanzas)
 *  - gasto_por_moneda: suma de (cantidad * precio_unitario) de ordenes_compra_detalle
 *    donde la OC NO esté RECHAZADA ni CANCELADA
 *
 * Filtro opcional: ?departamento_id=X  (filtra OCs cuyo RFQ pertenezca a ese departamento)
 */
const getProyectosDashboard = async (req, res) => {
  try {
    const { departamento_id } = req.query;

    // 1) Proyectos activos — excluye sitio "UNIDADES"
    //    Incluye responsable, cliente y departamento del responsable
    const proyectosQuery = `
      SELECT
        p.id,
        p.nombre,
        p.status,
        p.fecha_inicio,
        p.fecha_cierre,
        p.total_facturado,
        p.total_facturado_moneda,
        p.costo_total,
        p.costo_total_moneda,
        p.margen_estimado,
        p.margen_moneda,
        s.nombre  AS sitio_nombre,
        s.id      AS sitio_id,
        u.nombre  AS responsable_nombre,
        u.id      AS responsable_id,
        c.razon_social AS cliente_nombre,
        c.id      AS cliente_id,
        d.nombre  AS departamento_nombre,
        d.id      AS departamento_id
      FROM proyectos p
      LEFT JOIN sitios s ON p.sitio_id = s.id
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      LEFT JOIN departamentos d ON u.departamento_id = d.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.activo = true
        AND (s.nombre IS NULL OR UPPER(TRIM(s.nombre)) <> 'UNIDADES')
      ORDER BY p.nombre ASC;
    `;
    const { rows: proyectos } = await pool.query(proyectosQuery);

    // 2) Gasto por moneda por proyecto (OCs no rechazadas/canceladas)
    //    Opcionalmente filtradas por departamento del RFQ
    let gastoQuery = `
      SELECT
        oc.proyecto_id,
        ocd.moneda,
        SUM(ocd.cantidad * ocd.precio_unitario) AS total
      FROM ordenes_compra oc
      JOIN ordenes_compra_detalle ocd ON ocd.orden_compra_id = oc.id
      WHERE oc.status IN ('APROBADA', 'EN_PROCESO', 'ENTREGADA')
        AND oc.proyecto_id IS NOT NULL
    `;
    const gastoParams = [];

    if (departamento_id) {
      gastoParams.push(departamento_id);
      gastoQuery += `
        AND oc.rfq_id IN (
          SELECT r.id FROM requisiciones r WHERE r.departamento_id = $${gastoParams.length}
        )
      `;
    }

    gastoQuery += `
      GROUP BY oc.proyecto_id, ocd.moneda
      ORDER BY oc.proyecto_id, ocd.moneda;
    `;

    const { rows: gastoRows } = await pool.query(gastoQuery, gastoParams);

    // Indexar gasto por proyecto_id
    const gastoMap = {};
    for (const row of gastoRows) {
      if (!gastoMap[row.proyecto_id]) {
        gastoMap[row.proyecto_id] = [];
      }
      gastoMap[row.proyecto_id].push({
        moneda: row.moneda,
        total: parseFloat(row.total) || 0,
      });
    }

    // 3) Armar respuesta
    const result = proyectos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      status: p.status,
      sitio_nombre: p.sitio_nombre,
      sitio_id: p.sitio_id,
      responsable_nombre: p.responsable_nombre || null,
      responsable_id: p.responsable_id || null,
      cliente_nombre: p.cliente_nombre || null,
      cliente_id: p.cliente_id || null,
      departamento_nombre: p.departamento_nombre || null,
      departamento_id: p.departamento_id || null,
      fecha_inicio: p.fecha_inicio,
      fecha_cierre: p.fecha_cierre,
      total_facturado: p.total_facturado ? parseFloat(p.total_facturado) : null,
      total_facturado_moneda: p.total_facturado_moneda?.trim() || null,
      costo_total: p.costo_total ? parseFloat(p.costo_total) : null,
      costo_total_moneda: p.costo_total_moneda?.trim() || null,
      margen_estimado: p.margen_estimado ? parseFloat(p.margen_estimado) : null,
      margen_moneda: p.margen_moneda?.trim() || null,
      gasto_por_moneda: gastoMap[p.id] || [],
    }));

    return res.json({
      proyectos: result,
      statusOptions: ALLOWED_PROYECTO_STATUS,
    });
  } catch (error) {
    console.error('Error en getProyectosDashboard:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * PATCH /api/dashboard/proyectos/:id/status
 * Body: { status: 'EN_EJECUCION' }
 */
const updateProyectoStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'Se requiere id y status.' });
  }

  if (!ALLOWED_PROYECTO_STATUS.includes(status)) {
    return res.status(400).json({
      error: `Status inválido: '${status}'. Permitidos: ${ALLOWED_PROYECTO_STATUS.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE proyectos SET status = $1 WHERE id = $2 AND activo = true RETURNING id, status`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado o inactivo.' });
    }

    return res.json({
      mensaje: `Status del proyecto actualizado a '${status}'.`,
      proyecto: result.rows[0],
    });
  } catch (error) {
    console.error(`Error al actualizar status del proyecto ${id}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * GET /api/dashboard/proyectos/:id/detalle
 * Returns detailed info for a specific project:
 * - Basic info (description, full dates, etc.)
 * - Milestones (hitos)
 * - Expenses breakdown by OC
 */
const getProyectoDetalle = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Se requiere ID del proyecto.' });
  }

  console.log(`[getProyectoDetalle] Solicitando detalle para proyecto ID: ${id}`);

  try {
    // 1. Project Info query
    const projectQuery = `
      SELECT
        p.*,
        s.nombre AS sitio_nombre,
        u.nombre AS responsable_nombre,
        c.razon_social AS cliente_nombre,
        d.nombre AS departamento_nombre
      FROM proyectos p
      LEFT JOIN sitios s ON p.sitio_id = s.id
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      LEFT JOIN departamentos d ON u.departamento_id = d.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = $1
    `;

    // 2. Milestones query
    const hitosQuery = `
      SELECT *
      FROM proyectos_hitos
      WHERE proyecto_id = $1
      ORDER BY target_date ASC NULLS LAST, id ASC
    `;

    // 3. Expenses by OC query
    // Group by OC ID and currency to handle multi-currency OCs if any
    const gastosQuery = `
      SELECT
        oc.id,
        oc.numero_oc,
        oc.status,
        oc.fecha_creacion,
        ocd.moneda,
        SUM(ocd.cantidad * ocd.precio_unitario) AS total
      FROM ordenes_compra oc
      JOIN ordenes_compra_detalle ocd ON oc.id = ocd.orden_compra_id
      WHERE oc.proyecto_id = $1
        AND oc.status IN ('APROBADA', 'EN_PROCESO', 'ENTREGADA')
      GROUP BY oc.id, oc.numero_oc, oc.status, oc.fecha_creacion, ocd.moneda
      ORDER BY oc.fecha_creacion DESC
    `;

    const [projectResult, hitosResult, gastosResult] = await Promise.all([
      pool.query(projectQuery, [id]),
      pool.query(hitosQuery, [id]),
      pool.query(gastosQuery, [id]),
    ]);

    if (projectResult.rowCount === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const rawProject = projectResult.rows[0];

    // Format expenses: array of objects
    const gastos = gastosResult.rows.map(row => ({
      id: row.id,
      numero_oc: row.numero_oc,
      status: row.status,
      fecha: row.fecha_creacion,
      moneda: row.moneda,
      total: parseFloat(row.total) || 0,
    }));

    return res.json({
      proyecto: {
        ...rawProject,
        total_facturado: rawProject.total_facturado ? parseFloat(rawProject.total_facturado) : null,
        costo_total: rawProject.costo_total ? parseFloat(rawProject.costo_total) : null,
        margen_estimado: rawProject.margen_estimado ? parseFloat(rawProject.margen_estimado) : null,
      },
      hitos: hitosResult.rows,
      gastos,
    });

  } catch (error) {
    console.error(`Error en getProyectoDetalle (ID: ${id}):`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getProyectosDashboard,
  updateProyectoStatus,
  getProyectoDetalle,
};
