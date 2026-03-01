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
const { sendEmailWithAttachments } = require('../../services/emailService');

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
    //    Se suman TODAS las OCs del proyecto sin filtrar por departamento,
    //    porque gasto_por_moneda es un indicador del proyecto completo.
    const gastoQuery = `
      SELECT
        oc.proyecto_id,
        ocd.moneda,
        SUM(ocd.cantidad * ocd.precio_unitario) AS total
      FROM ordenes_compra oc
      JOIN ordenes_compra_detalle ocd ON ocd.orden_compra_id = oc.id
      WHERE oc.status IN ('APROBADA', 'EN_PROCESO', 'ENTREGADA')
        AND oc.proyecto_id IS NOT NULL
      GROUP BY oc.proyecto_id, ocd.moneda
      ORDER BY oc.proyecto_id, ocd.moneda;
    `;

    const { rows: gastoRows } = await pool.query(gastoQuery);

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

    // 2. Milestones query — incluye responsables desde tabla puente
    const hitosQuery = `
      SELECT
        ph.id,
        ph.proyecto_id,
        ph.nombre,
        ph.descripcion,
        ph.target_date,
        ph.fecha_realizacion,
        ph.creado_en,
        ph.actualizado_en,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', u.id, 'nombre', u.nombre)
            ORDER BY u.nombre
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS responsables
      FROM proyectos_hitos ph
      LEFT JOIN proyectos_hitos_responsables phr ON phr.hito_id = ph.id
      LEFT JOIN usuarios u ON u.id = phr.usuario_id
      WHERE ph.proyecto_id = $1
      GROUP BY ph.id, ph.proyecto_id, ph.nombre, ph.descripcion, ph.target_date,
               ph.fecha_realizacion, ph.creado_en, ph.actualizado_en
      ORDER BY ph.target_date ASC NULLS LAST, ph.id ASC
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

/**
 * GET /api/dashboard/proyectos/:id/hitos
 * Retorna los hitos de un proyecto con responsables y conteo de comentarios.
 */
const getHitosProyecto = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Se requiere ID del proyecto.' });
  }

  try {
    const hitosQuery = `
      SELECT
        ph.id,
        ph.proyecto_id,
        ph.nombre,
        ph.descripcion,
        ph.target_date,
        ph.fecha_realizacion,
        ph.creado_en,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', u.id, 'nombre', u.nombre)
            ORDER BY u.nombre
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS responsables,
        (SELECT COUNT(*) FROM public.proyectos_hitos_comentarios c WHERE c.hito_id = ph.id) AS total_comentarios
      FROM public.proyectos_hitos ph
      LEFT JOIN public.proyectos_hitos_responsables phr ON phr.hito_id = ph.id
      LEFT JOIN public.usuarios u ON u.id = phr.usuario_id
      WHERE ph.proyecto_id = $1
      GROUP BY ph.id, ph.proyecto_id, ph.nombre, ph.descripcion, ph.target_date,
               ph.fecha_realizacion, ph.creado_en
      ORDER BY ph.target_date ASC NULLS LAST, ph.id ASC;
    `;

    const { rows } = await pool.query(hitosQuery, [id]);

    const today = new Date().toISOString().split('T')[0];
    const hitos = rows.map((h) => {
      const td = h.target_date ? (h.target_date.toISOString?.()?.split('T')[0] ?? h.target_date) : null;
      let estado;
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
        total_comentarios: parseInt(h.total_comentarios, 10) || 0,
      };
    });

    return res.json({ hitos });
  } catch (error) {
    console.error(`Error en getHitosProyecto (ID: ${id}):`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * POST /api/dashboard/proyectos/:id/hitos
 * Body: { nombre, descripcion?, target_date?, responsable_id? }
 * Agrega un hito rápidamente a un proyecto existente.
 */
const agregarHitoProyecto = async (req, res) => {
  const proyectoId = Number(req.params.id);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    return res.status(400).json({ error: 'ID de proyecto inválido.' });
  }

  const nombre = (req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre del hito es obligatorio.' });
  if (nombre.length > 150) return res.status(400).json({ error: 'El nombre no puede exceder 150 caracteres.' });

  const descripcion = (req.body?.descripcion || '').trim() || null;
  const target_date = req.body?.target_date || null;

  // Aceptar responsable_ids (array) o responsable_id (legado) como fallback
  let responsable_ids = [];
  if (Array.isArray(req.body?.responsable_ids)) {
    responsable_ids = req.body.responsable_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } else if (req.body?.responsable_id) {
    const single = Number(req.body.responsable_id);
    if (Number.isInteger(single) && single > 0) responsable_ids = [single];
  }

  if (target_date && !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const proyCheck = await client.query(
      `SELECT id, nombre FROM public.proyectos WHERE id = $1 AND activo = true`,
      [proyectoId]
    );
    if (proyCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Proyecto no encontrado o inactivo.' });
    }
    const proyectoNombre = proyCheck.rows[0].nombre;

    // Verificar y cargar datos de todos los responsables
    const responsablesData = [];
    for (const rId of responsable_ids) {
      const respCheck = await client.query(
        `SELECT id, nombre, correo FROM public.usuarios WHERE id = $1`,
        [rId]
      );
      if (respCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Responsable con ID ${rId} no encontrado.` });
      }
      responsablesData.push(respCheck.rows[0]);
    }

    const hitoRes = await client.query(
      `INSERT INTO public.proyectos_hitos (proyecto_id, nombre, descripcion, target_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, proyecto_id, nombre, descripcion, target_date, fecha_realizacion, creado_en`,
      [proyectoId, nombre, descripcion, target_date]
    );
    const hito = hitoRes.rows[0];

    for (const rId of responsable_ids) {
      await client.query(
        `INSERT INTO public.proyectos_hitos_responsables (hito_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [hito.id, rId]
      );
    }

    await client.query('COMMIT');

    // Enviar correo a cada responsable (sin bloquear la respuesta)
    if (responsablesData.length > 0) {
      const asignador = req.usuarioSira?.nombre || 'Un usuario de SIRA';
      const fechaStr = hito.target_date
        ? new Date(hito.target_date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;
      const descripcionHtml = descripcion
        ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Descripción</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${descripcion}</td></tr>`
        : '';
      const fechaHtml = fechaStr
        ? `<tr><td style="padding:8px 12px;color:#6b7280;font-weight:600;white-space:nowrap;">Fecha objetivo</td><td style="padding:8px 12px;">${fechaStr}</td></tr>`
        : '';
      const subject = `Nuevo hito asignado: ${nombre} — ${proyectoNombre}`;

      for (const r of responsablesData) {
        if (!r.correo) continue;
        const htmlBody = `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;max-width:600px;">
            <p>Estimado/a <strong>${r.nombre}</strong>,</p>
            <p>Se le ha asignado un nuevo hito dentro del sistema <strong>SIRA</strong>.
               A continuación se detallan los datos correspondientes:</p>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0;">
              <tr style="background:#f9fafb;">
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Hito</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${nombre}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Proyecto</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${proyectoNombre}</td>
              </tr>
              ${descripcionHtml}
              ${fechaHtml}
              <tr style="background:#f9fafb;">
                <td style="padding:8px 12px;color:#6b7280;font-weight:600;white-space:nowrap;">Asignado por</td>
                <td style="padding:8px 12px;">${asignador}</td>
              </tr>
            </table>
            <p>Le solicitamos atender este hito conforme a los tiempos establecidos.</p>
            <p style="color:#6b7280;font-size:12px;margin-top:24px;">
              Este es un correo automático generado por SIRA. Por favor, no responda directamente a este mensaje.
            </p>
          </div>
        `;
        sendEmailWithAttachments([r.correo], subject, htmlBody, []).catch((emailErr) => {
          console.error(`[agregarHitoProyecto] Error al enviar correo a ${r.correo}:`, emailErr);
        });
      }
    }

    return res.status(201).json({
      mensaje: 'Hito agregado correctamente.',
      hito: {
        ...hito,
        target_date: hito.target_date
          ? (hito.target_date.toISOString?.()?.split('T')[0] ?? hito.target_date)
          : null,
        responsables: responsablesData.map(r => ({ id: r.id, nombre: r.nombre })),
        total_comentarios: 0,
        estado: 'PENDIENTE',
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(`Error al agregar hito al proyecto ${proyectoId}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getProyectosDashboard,
  updateProyectoStatus,
  getProyectoDetalle,
  getHitosProyecto,
  agregarHitoProyecto,
};
