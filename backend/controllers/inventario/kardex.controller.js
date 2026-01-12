// backend/controllers/inventario/kardex.controller.js
/**
 * GET /api/inventario/kardex
 * =============================================================================
 * Filtros:
 * - materialId, proyectoId, ubicacionId, tipoMovimiento, ordenCompraId, requisicionId, usuarioId
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
      ubicacionId,
      tipoMovimiento,
      ordenCompraId,
      requisicionId,
      usuarioId,
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
        mi.requisicion_id,
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

module.exports = { getKardex };
