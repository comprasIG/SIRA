// C:\SIRA\backend\controllers\dashboard\hitosDashboard.controller.js
/**
 * ============================================================================
 * SIRA - Dashboard de Hitos / KPI "TO DO"
 * ----------------------------------------------------------------------------
 * Endpoints:
 *   GET   /api/dashboard/hitos
 *         ?departamento_id=X   → filtra por departamento de cualquier responsable del hito
 *         &all_depts=true      → devuelve hitos de todos los departamentos
 *         &include_done=true   → incluye hitos ya realizados (default: solo pendientes)
 *   PATCH /api/dashboard/hitos/:id/realizado
 *   PATCH /api/dashboard/hitos/:id/pendiente
 *   GET   /api/dashboard/hitos/:id/comentarios
 *   POST  /api/dashboard/hitos/:id/comentarios
 *   POST  /api/dashboard/hitos/comentarios/:comentarioId/responder
 *   PATCH /api/dashboard/hitos/comentarios/:comentarioId/status
 * ============================================================================
 */

const pool = require('../../db/pool');

/**
 * GET /api/dashboard/hitos
 * Ahora los responsables vienen de la tabla puente proyectos_hitos_responsables.
 * Retorna array de responsables en cada hito.
 */
const getHitosDashboard = async (req, res) => {
  try {
    const { departamento_id, all_depts, include_done } = req.query;

    const usuarioDeptId = req.usuarioSira?.departamento_id || null;

    const mostrarTodos = all_depts === 'true';
    const includeDone = include_done === 'true';

    const deptFiltro = departamento_id
      ? Number(departamento_id)
      : (!mostrarTodos && usuarioDeptId ? Number(usuarioDeptId) : null);

    const params = [];
    let whereExtra = '';

    if (!includeDone) {
      whereExtra += ' AND ph.fecha_realizacion IS NULL';
    }

    // Filtrar por departamento: el hito debe tener AL MENOS un responsable en ese departamento
    if (deptFiltro && !mostrarTodos) {
      params.push(deptFiltro);
      whereExtra += `
        AND EXISTS (
          SELECT 1
          FROM public.proyectos_hitos_responsables phr_f
          JOIN public.usuarios uf ON uf.id = phr_f.usuario_id
          JOIN public.departamentos df ON df.id = uf.departamento_id
          WHERE phr_f.hito_id = ph.id AND df.id = $${params.length}
        )`;
    }

    // Requerir que el hito tenga al menos un responsable
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
        ph.creado_en,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',                 u.id,
              'nombre',             u.nombre,
              'departamento_id',    d.id,
              'departamento_nombre',d.nombre
            )
            ORDER BY u.nombre
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS responsables
      FROM public.proyectos_hitos ph
      JOIN public.proyectos p ON p.id = ph.proyecto_id
      LEFT JOIN public.proyectos_hitos_responsables phr ON phr.hito_id = ph.id
      LEFT JOIN public.usuarios u ON u.id = phr.usuario_id
      LEFT JOIN public.departamentos d ON d.id = u.departamento_id
      WHERE p.activo = true
        AND EXISTS (
          SELECT 1 FROM public.proyectos_hitos_responsables r WHERE r.hito_id = ph.id
        )
        ${whereExtra}
      GROUP BY ph.id, ph.nombre, ph.descripcion, ph.target_date, ph.fecha_realizacion,
               ph.proyecto_id, p.nombre, p.status, ph.creado_en
      ORDER BY
        ph.fecha_realizacion IS NOT NULL ASC,
        ph.target_date ASC NULLS LAST,
        ph.id ASC;
    `;

    const { rows } = await pool.query(query, params);

    const today = new Date().toISOString().split('T')[0];
    const hitos = rows.map((h) => {
      let estado;
      const td = h.target_date ? (h.target_date.toISOString?.()?.split('T')[0] ?? h.target_date) : null;
      if (h.fecha_realizacion) {
        estado = 'REALIZADO';
      } else if (td && td < today) {
        estado = 'VENCIDO';
      } else {
        estado = 'PENDIENTE';
      }
      return {
        ...h,
        target_date: td,
        fecha_realizacion: h.fecha_realizacion
          ? (h.fecha_realizacion.toISOString?.()?.split('T')[0] ?? h.fecha_realizacion)
          : null,
        estado,
        responsables: h.responsables || [],
        // compatibilidad legacy: primer responsable (o null)
        responsable_nombre: h.responsables?.[0]?.nombre || null,
        departamento_nombre: h.responsables?.[0]?.departamento_nombre || null,
      };
    });

    const kpis = {
      total: hitos.length,
      pendientes: hitos.filter((h) => h.estado === 'PENDIENTE').length,
      vencidos: hitos.filter((h) => h.estado === 'VENCIDO').length,
      realizados: hitos.filter((h) => h.estado === 'REALIZADO').length,
    };

    // Departamentos disponibles para filtro
    const deptsQuery = `
      SELECT DISTINCT d.id, d.nombre
      FROM public.proyectos_hitos_responsables phr
      JOIN public.usuarios u ON u.id = phr.usuario_id
      JOIN public.departamentos d ON d.id = u.departamento_id
      JOIN public.proyectos_hitos ph ON ph.id = phr.hito_id
      JOIN public.proyectos p ON p.id = ph.proyecto_id
      WHERE p.activo = true
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

/**
 * GET /api/dashboard/hitos/:id/comentarios
 * Retorna comentarios del hito en estructura de threads (raíces con sus respuestas).
 */
const getComentariosHito = async (req, res) => {
  const hitoId = Number(req.params.id);
  if (!Number.isInteger(hitoId) || hitoId <= 0) {
    return res.status(400).json({ error: 'ID de hito inválido.' });
  }

  try {
    // Verificar que el hito exista
    const hitoCheck = await pool.query(
      `SELECT ph.id, ph.nombre, p.nombre AS proyecto_nombre
         FROM public.proyectos_hitos ph
         JOIN public.proyectos p ON p.id = ph.proyecto_id
        WHERE ph.id = $1`,
      [hitoId]
    );
    if (hitoCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Hito no encontrado.' });
    }

    const comentariosQuery = `
      SELECT
        c.id,
        c.hito_id,
        c.usuario_id,
        c.parent_id,
        c.comentario,
        c.status,
        c.creado_en,
        c.actualizado_en,
        u.nombre AS usuario_nombre
      FROM public.proyectos_hitos_comentarios c
      LEFT JOIN public.usuarios u ON u.id = c.usuario_id
      WHERE c.hito_id = $1
      ORDER BY c.creado_en ASC;
    `;

    const { rows } = await pool.query(comentariosQuery, [hitoId]);

    // Construir árbol de threads
    const rootComments = [];
    const byId = {};

    rows.forEach((c) => {
      byId[c.id] = { ...c, respuestas: [] };
    });

    rows.forEach((c) => {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].respuestas.push(byId[c.id]);
      } else {
        rootComments.push(byId[c.id]);
      }
    });

    return res.json({
      hito: hitoCheck.rows[0],
      comentarios: rootComments,
    });
  } catch (error) {
    console.error(`Error en getComentariosHito (${hitoId}):`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * POST /api/dashboard/hitos/:id/comentarios
 * Body: { comentario: string }
 * Agrega un comentario raíz al hito.
 */
const addComentarioHito = async (req, res) => {
  const hitoId = Number(req.params.id);
  if (!Number.isInteger(hitoId) || hitoId <= 0) {
    return res.status(400).json({ error: 'ID de hito inválido.' });
  }

  const comentarioText = (req.body?.comentario || '').trim();
  if (!comentarioText) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  }

  const usuarioId = req.usuarioSira?.id || null;

  try {
    const hitoCheck = await pool.query(
      `SELECT id FROM public.proyectos_hitos WHERE id = $1`,
      [hitoId]
    );
    if (hitoCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Hito no encontrado.' });
    }

    const result = await pool.query(
      `INSERT INTO public.proyectos_hitos_comentarios
         (hito_id, usuario_id, parent_id, comentario, status)
       VALUES ($1, $2, NULL, $3, 'PENDIENTE')
       RETURNING id, hito_id, usuario_id, parent_id, comentario, status, creado_en`,
      [hitoId, usuarioId, comentarioText]
    );

    const row = result.rows[0];
    // Obtener nombre del usuario para retornar
    let usuario_nombre = null;
    if (usuarioId) {
      const uRes = await pool.query(`SELECT nombre FROM public.usuarios WHERE id = $1`, [usuarioId]);
      if (uRes.rowCount > 0) usuario_nombre = uRes.rows[0].nombre;
    }

    return res.status(201).json({
      mensaje: 'Comentario agregado.',
      comentario: { ...row, usuario_nombre, respuestas: [] },
    });
  } catch (error) {
    console.error(`Error al agregar comentario al hito ${hitoId}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * POST /api/dashboard/hitos/comentarios/:comentarioId/responder
 * Body: { comentario: string }
 * Agrega una respuesta a un comentario existente.
 */
const responderComentario = async (req, res) => {
  const comentarioId = Number(req.params.comentarioId);
  if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
    return res.status(400).json({ error: 'ID de comentario inválido.' });
  }

  const comentarioText = (req.body?.comentario || '').trim();
  if (!comentarioText) {
    return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
  }

  const usuarioId = req.usuarioSira?.id || null;

  try {
    const parentCheck = await pool.query(
      `SELECT id, hito_id FROM public.proyectos_hitos_comentarios WHERE id = $1`,
      [comentarioId]
    );
    if (parentCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Comentario padre no encontrado.' });
    }

    const hitoId = parentCheck.rows[0].hito_id;

    const result = await pool.query(
      `INSERT INTO public.proyectos_hitos_comentarios
         (hito_id, usuario_id, parent_id, comentario, status)
       VALUES ($1, $2, $3, $4, 'PENDIENTE')
       RETURNING id, hito_id, usuario_id, parent_id, comentario, status, creado_en`,
      [hitoId, usuarioId, comentarioId, comentarioText]
    );

    const row = result.rows[0];
    let usuario_nombre = null;
    if (usuarioId) {
      const uRes = await pool.query(`SELECT nombre FROM public.usuarios WHERE id = $1`, [usuarioId]);
      if (uRes.rowCount > 0) usuario_nombre = uRes.rows[0].nombre;
    }

    return res.status(201).json({
      mensaje: 'Respuesta agregada.',
      comentario: { ...row, usuario_nombre, respuestas: [] },
    });
  } catch (error) {
    console.error(`Error al responder comentario ${comentarioId}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * PATCH /api/dashboard/hitos/comentarios/:comentarioId/status
 * Body: { status: 'PENDIENTE' | 'RESUELTO' }
 */
const cambiarStatusComentario = async (req, res) => {
  const comentarioId = Number(req.params.comentarioId);
  if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
    return res.status(400).json({ error: 'ID de comentario inválido.' });
  }

  const status = (req.body?.status || '').trim().toUpperCase();
  if (!['PENDIENTE', 'RESUELTO'].includes(status)) {
    return res.status(400).json({ error: "Status inválido. Usa 'PENDIENTE' o 'RESUELTO'." });
  }

  try {
    const result = await pool.query(
      `UPDATE public.proyectos_hitos_comentarios
          SET status = $1
        WHERE id = $2
        RETURNING id, status, actualizado_en`,
      [status, comentarioId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }

    return res.json({
      mensaje: `Comentario marcado como ${status}.`,
      comentario: result.rows[0],
    });
  } catch (error) {
    console.error(`Error al cambiar status del comentario ${comentarioId}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getHitosDashboard,
  marcarHitoRealizado,
  marcarHitoPendiente,
  getComentariosHito,
  addComentarioHito,
  responderComentario,
  cambiarStatusComentario,
};
