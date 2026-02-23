// C:\SIRA\backend\controllers\dashboard\hitosDashboard.controller.js
/**
 * ============================================================================
 * SIRA - Dashboard de Hitos / KPI "TO DO"
 * ----------------------------------------------------------------------------
 * Endpoints:
 *   GET   /api/dashboard/hitos
 *         ?departamento_id=X   → filtra por departamento del responsable del hito
 *         &all_depts=true      → devuelve hitos de todos los departamentos
 *         &include_done=true   → incluye hitos ya realizados (default: solo pendientes)
 *   PATCH /api/dashboard/hitos/:id/realizado
 *         Marca un hito como realizado (fecha_realizacion = hoy)
 *   PATCH /api/dashboard/hitos/:id/pendiente
 *         Revierte un hito a pendiente (fecha_realizacion = NULL)
 * ============================================================================
 */

const pool = require('../../db/pool');

/**
 * GET /api/dashboard/hitos
 */
const getHitosDashboard = async (req, res) => {
  try {
    const { departamento_id, all_depts, include_done } = req.query;

    // El usuario autenticado viene en req.usuarioSira (del middleware loadSiraUser)
    const usuarioDeptId = req.usuarioSira?.departamento_id || null;

    // Calcular el filtro de departamento efectivo
    const mostrarTodos = all_depts === 'true';
    const includeDone = include_done === 'true';

    // Departamento a filtrar: si viene explícito en query, úsalo; si no, usa el del usuario
    const deptFiltro = departamento_id
      ? Number(departamento_id)
      : (!mostrarTodos && usuarioDeptId ? Number(usuarioDeptId) : null);

    const params = [];
    let whereClause = '';

    if (!includeDone) {
      whereClause += ' AND ph.fecha_realizacion IS NULL';
    }

    if (deptFiltro && !mostrarTodos) {
      params.push(deptFiltro);
      whereClause += ` AND d.id = $${params.length}`;
    }

    const query = `
      SELECT
        ph.id,
        ph.nombre,
        ph.descripcion,
        ph.target_date,
        ph.fecha_realizacion,
        ph.proyecto_id,
        p.nombre       AS proyecto_nombre,
        p.status       AS proyecto_status,
        ph.responsable_id,
        u.nombre       AS responsable_nombre,
        d.id           AS departamento_id,
        d.nombre       AS departamento_nombre,
        ph.creado_en
      FROM public.proyectos_hitos ph
      JOIN public.proyectos p ON p.id = ph.proyecto_id
      LEFT JOIN public.usuarios u ON u.id = ph.responsable_id
      LEFT JOIN public.departamentos d ON d.id = u.departamento_id
      WHERE ph.responsable_id IS NOT NULL
        AND p.activo = true
        ${whereClause}
      ORDER BY
        ph.fecha_realizacion IS NOT NULL ASC,  -- pendientes primero
        ph.target_date ASC NULLS LAST,
        ph.id ASC;
    `;

    const { rows } = await pool.query(query, params);

    // Enriquecer con estado calculado
    const today = new Date().toISOString().split('T')[0];
    const hitos = rows.map((h) => {
      let estado;
      if (h.fecha_realizacion) {
        estado = 'REALIZADO';
      } else if (h.target_date && h.target_date.toISOString?.()?.split('T')[0] < today) {
        estado = 'VENCIDO';
      } else if (h.target_date && h.target_date < today) {
        estado = 'VENCIDO';
      } else {
        estado = 'PENDIENTE';
      }
      return {
        ...h,
        target_date: h.target_date ? (h.target_date.toISOString?.()?.split('T')[0] ?? h.target_date) : null,
        fecha_realizacion: h.fecha_realizacion
          ? (h.fecha_realizacion.toISOString?.()?.split('T')[0] ?? h.fecha_realizacion)
          : null,
        estado,
      };
    });

    // KPIs
    const kpis = {
      total: hitos.length,
      pendientes: hitos.filter((h) => h.estado === 'PENDIENTE').length,
      vencidos: hitos.filter((h) => h.estado === 'VENCIDO').length,
      realizados: hitos.filter((h) => h.estado === 'REALIZADO').length,
    };

    // Opciones para filtros de departamento (todos los departamentos con hitos asignados)
    const deptsQuery = `
      SELECT DISTINCT d.id, d.nombre
      FROM public.proyectos_hitos ph
      JOIN public.usuarios u ON u.id = ph.responsable_id
      JOIN public.departamentos d ON d.id = u.departamento_id
      JOIN public.proyectos p ON p.id = ph.proyecto_id
      WHERE ph.responsable_id IS NOT NULL AND p.activo = true
      ORDER BY d.nombre ASC;
    `;
    const { rows: deptsRows } = await pool.query(deptsQuery);

    return res.json({
      hitos,
      kpis,
      departamentos: deptsRows,
      usuarioDepartamento_id: usuarioDeptId,
    });
  } catch (error) {
    console.error('Error en getHitosDashboard:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * PATCH /api/dashboard/hitos/:id/realizado
 * Marca el hito como realizado (fecha_realizacion = hoy)
 */
const marcarHitoRealizado = async (req, res) => {
  const hitoId = Number(req.params.id);
  if (!Number.isInteger(hitoId) || hitoId <= 0) {
    return res.status(400).json({ error: 'ID de hito inválido.' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.proyectos_hitos
          SET fecha_realizacion = CURRENT_DATE
        WHERE id = $1
        RETURNING id, nombre, fecha_realizacion`,
      [hitoId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Hito no encontrado.' });
    }

    return res.json({
      mensaje: 'Hito marcado como realizado.',
      hito: result.rows[0],
    });
  } catch (error) {
    console.error(`Error al marcar hito ${hitoId} como realizado:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * PATCH /api/dashboard/hitos/:id/pendiente
 * Revierte el hito a pendiente (fecha_realizacion = NULL)
 */
const marcarHitoPendiente = async (req, res) => {
  const hitoId = Number(req.params.id);
  if (!Number.isInteger(hitoId) || hitoId <= 0) {
    return res.status(400).json({ error: 'ID de hito inválido.' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.proyectos_hitos
          SET fecha_realizacion = NULL
        WHERE id = $1
        RETURNING id, nombre, fecha_realizacion`,
      [hitoId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Hito no encontrado.' });
    }

    return res.json({
      mensaje: 'Hito revertido a pendiente.',
      hito: result.rows[0],
    });
  } catch (error) {
    console.error(`Error al revertir hito ${hitoId} a pendiente:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getHitosDashboard,
  marcarHitoRealizado,
  marcarHitoPendiente,
};