// backend/controllers/inventario/kardex.controller.js
/**
 * GET /api/inventario/kardex
 * =============================================================================
 * Filtros:
 * - materialId, proyectoId, sitioId, ubicacionId, tipoMovimiento
 * - ordenCompraId, requisicionId, usuarioId, proveedorId
 * - fechaInicio, fechaFin (YYYY-MM-DD)
 * - includeAnulados (true/false)
 * - q (texto en observaciones)
 * - limit, offset
 */

const pool = require("../../db/pool");
const { respond500 } = require("./helpers");

const getKardex = async (req, res) => {
  try {
    const {
      materialId,
      proyectoId,
      sitioId,
      ubicacionId,
      tipoMovimiento,
      ordenCompraId,
      requisicionId,
      usuarioId,
      proveedorId,
      fechaInicio,
      fechaFin,
      includeAnulados = "false",
      limit = "100",
      offset = "0",
      q,
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    const where = [];
    const values = [];
    let i = 1;

    if (includeAnulados !== "true") where.push(`mi.estado = 'ACTIVO'`);

    if (materialId) {
      where.push(`mi.material_id = $${i++}`);
      values.push(materialId);
    }

    if (proyectoId) {
      // Para TRASPASO, el proyecto puede estar como origen o destino
      where.push(`(mi.proyecto_origen_id = $${i} OR mi.proyecto_destino_id = $${i})`);
      values.push(proyectoId);
      i++;
    }

    if (sitioId) {
      where.push(`oc_join.sitio_id = $${i++}`);
      values.push(sitioId);
    }

    if (ubicacionId) {
      where.push(`mi.ubicacion_id = $${i++}`);
      values.push(ubicacionId);
    }

    if (tipoMovimiento) {
      where.push(`mi.tipo_movimiento = $${i++}`);
      values.push(tipoMovimiento);
    }

    if (ordenCompraId) {
      where.push(`mi.orden_compra_id = $${i++}`);
      values.push(ordenCompraId);
    }

    if (requisicionId) {
      where.push(`mi.requisicion_id = $${i++}`);
      values.push(requisicionId);
    }

    if (usuarioId) {
      where.push(`mi.usuario_id = $${i++}`);
      values.push(usuarioId);
    }

    if (proveedorId) {
      where.push(`oc_join.proveedor_id = $${i++}`);
      values.push(proveedorId);
    }

    if (fechaInicio) {
      where.push(`mi.fecha >= $${i++}::timestamptz`);
      values.push(`${fechaInicio} 00:00:00`);
    }

    if (fechaFin) {
      where.push(`mi.fecha <= $${i++}::timestamptz`);
      values.push(`${fechaFin} 23:59:59`);
    }

    if (q) {
      where.push(`COALESCE(mi.observaciones, '') ILIKE $${i++}`);
      values.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        mi.id,
        mi.fecha,
        mi.tipo_movimiento,
        mi.material_id,
        cm.nombre AS material_descripcion,
        cm.sku AS material_sku,
        mi.cantidad,
        mi.valor_unitario,
        mi.valor_total,
        mi.moneda,
        mi.ubicacion_id,
        ua.nombre AS ubicacion_nombre,
        mi.proyecto_origen_id,
        po.nombre AS proyecto_origen_nombre,
        mi.proyecto_destino_id,
        pd.nombre AS proyecto_destino_nombre,
        mi.orden_compra_id,
        oc_join.numero_oc,
        oc_join.proveedor_id,
        prov.razon_social AS proveedor_nombre,
        mi.requisicion_id,
        req.rfq_code AS rfq_code,
        mi.asignacion_origen_id,
        mi.usuario_id,
        u.nombre AS usuario_nombre,
        mi.observaciones,
        mi.estado,
        mi.anulado_en,
        mi.anulado_por,
        u2.nombre AS anulado_por_nombre,
        mi.motivo_anulacion,
        mi.reversa_de_movimiento_id
      FROM public.movimientos_inventario mi
      LEFT JOIN public.catalogo_materiales cm ON cm.id = mi.material_id
      LEFT JOIN public.ubicaciones_almacen ua ON ua.id = mi.ubicacion_id
      LEFT JOIN public.proyectos po ON po.id = mi.proyecto_origen_id
      LEFT JOIN public.proyectos pd ON pd.id = mi.proyecto_destino_id
      LEFT JOIN public.ordenes_compra oc_join ON oc_join.id = mi.orden_compra_id
      LEFT JOIN public.proveedores prov ON prov.id = oc_join.proveedor_id
      LEFT JOIN public.requisiciones req ON req.id = mi.requisicion_id
      LEFT JOIN public.usuarios u ON u.id = mi.usuario_id
      LEFT JOIN public.usuarios u2 ON u2.id = mi.anulado_por
      ${whereSql}
      ORDER BY mi.fecha DESC, mi.id DESC
      LIMIT $${i++} OFFSET $${i++};
    `;

    values.push(lim, off);

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.movimientos_inventario mi
      LEFT JOIN public.ordenes_compra oc_join ON oc_join.id = mi.orden_compra_id
      ${whereSql};
    `;
    const countValues = values.slice(0, values.length - 2);

    const [rowsResult, countResult] = await Promise.all([
      pool.query(sql, values),
      pool.query(countSql, countValues),
    ]);

    return res.status(200).json({
      total: countResult.rows[0]?.total ?? 0,
      limit: lim,
      offset: off,
      rows: rowsResult.rows || [],
    });
  } catch (error) {
    return respond500(res, "Error en getKardex:", error, "Error al consultar el kardex.");
  }
};

/* ================================================================================================
 * GET /api/inventario/kardex/opciones-filtros
 * Devuelve opciones de filtro dinámicas según los filtros actuales
 * ==============================================================================================*/
const getKardexFilterOptions = async (req, res) => {
  try {
    const {
      materialId,
      proyectoId,
      sitioId,
      tipoMovimiento,
      ordenCompraId,
      requisicionId,
      usuarioId,
      proveedorId,
      fechaInicio,
      fechaFin,
      includeAnulados = "false",
    } = req.query;

    const where = [];
    const values = [];
    let i = 1;

    if (includeAnulados !== "true") where.push(`mi.estado = 'ACTIVO'`);
    if (materialId) { where.push(`mi.material_id = $${i++}`); values.push(materialId); }
    if (proyectoId) {
      where.push(`(mi.proyecto_origen_id = $${i} OR mi.proyecto_destino_id = $${i})`);
      values.push(proyectoId); i++;
    }
    if (sitioId) { where.push(`oc_j.sitio_id = $${i++}`); values.push(sitioId); }
    if (tipoMovimiento) { where.push(`mi.tipo_movimiento = $${i++}`); values.push(tipoMovimiento); }
    if (ordenCompraId) { where.push(`mi.orden_compra_id = $${i++}`); values.push(ordenCompraId); }
    if (requisicionId) { where.push(`mi.requisicion_id = $${i++}`); values.push(requisicionId); }
    if (usuarioId) { where.push(`mi.usuario_id = $${i++}`); values.push(usuarioId); }
    if (proveedorId) { where.push(`oc_j.proveedor_id = $${i++}`); values.push(proveedorId); }
    if (fechaInicio) { where.push(`mi.fecha >= $${i++}::timestamptz`); values.push(`${fechaInicio} 00:00:00`); }
    if (fechaFin) { where.push(`mi.fecha <= $${i++}::timestamptz`); values.push(`${fechaFin} 23:59:59`); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      WITH filtered AS (
        SELECT
          mi.material_id,
          mi.proyecto_origen_id,
          mi.proyecto_destino_id,
          mi.tipo_movimiento,
          mi.orden_compra_id,
          mi.requisicion_id,
          mi.usuario_id,
          oc_j.sitio_id   AS oc_sitio_id,
          oc_j.proveedor_id AS oc_proveedor_id
        FROM public.movimientos_inventario mi
        LEFT JOIN public.ordenes_compra oc_j ON oc_j.id = mi.orden_compra_id
        ${whereSql}
      )
      SELECT
        'proyectos' AS dimension,
        p.id::text AS value_id,
        p.nombre   AS value_label,
        NULL       AS value_extra
      FROM (
        SELECT DISTINCT unnest(ARRAY[f.proyecto_origen_id, f.proyecto_destino_id]) AS pid
        FROM filtered f
      ) sub
      JOIN public.proyectos p ON p.id = sub.pid
      WHERE sub.pid IS NOT NULL

      UNION ALL

      SELECT 'sitios', s.id::text, s.nombre, NULL
      FROM (SELECT DISTINCT f.oc_sitio_id FROM filtered f WHERE f.oc_sitio_id IS NOT NULL) sub
      JOIN public.sitios s ON s.id = sub.oc_sitio_id

      UNION ALL

      SELECT 'materiales', cm.id::text, cm.nombre, cm.sku
      FROM (SELECT DISTINCT f.material_id FROM filtered f WHERE f.material_id IS NOT NULL) sub
      JOIN public.catalogo_materiales cm ON cm.id = sub.material_id

      UNION ALL

      SELECT 'proveedores', prov.id::text, COALESCE(prov.razon_social, prov.marca), NULL
      FROM (SELECT DISTINCT f.oc_proveedor_id FROM filtered f WHERE f.oc_proveedor_id IS NOT NULL) sub
      JOIN public.proveedores prov ON prov.id = sub.oc_proveedor_id

      UNION ALL

      SELECT 'usuarios', u.id::text, u.nombre, NULL
      FROM (SELECT DISTINCT f.usuario_id FROM filtered f WHERE f.usuario_id IS NOT NULL) sub
      JOIN public.usuarios u ON u.id = sub.usuario_id

      UNION ALL

      SELECT 'tipos', f.tipo_movimiento::text, f.tipo_movimiento::text, NULL
      FROM (SELECT DISTINCT tipo_movimiento FROM filtered WHERE tipo_movimiento IS NOT NULL) f

      UNION ALL

      SELECT 'ocs', f.orden_compra_id::text, oc2.numero_oc::text, NULL
      FROM (SELECT DISTINCT orden_compra_id FROM filtered WHERE orden_compra_id IS NOT NULL) f
      JOIN public.ordenes_compra oc2 ON oc2.id = f.orden_compra_id

      UNION ALL

      SELECT 'requisiciones', f.requisicion_id::text, r.rfq_code, NULL
      FROM (SELECT DISTINCT requisicion_id FROM filtered WHERE requisicion_id IS NOT NULL) f
      JOIN public.requisiciones r ON r.id = f.requisicion_id

      ORDER BY dimension, value_label;
    `;

    const result = await pool.query(sql, values);

    // Group by dimension
    const options = {
      proyectos: [],
      sitios: [],
      materiales: [],
      proveedores: [],
      usuarios: [],
      tipos: [],
      ocs: [],
      requisiciones: [],
    };

    for (const row of result.rows) {
      const entry = { id: row.value_id, nombre: row.value_label };
      if (row.value_extra) entry.extra = row.value_extra;
      if (options[row.dimension]) options[row.dimension].push(entry);
    }

    return res.status(200).json(options);
  } catch (error) {
    return respond500(res, "Error en getKardexFilterOptions:", error, "Error al obtener opciones de filtro.");
  }
};

module.exports = { getKardex, getKardexFilterOptions };
