// backend/controllers/inventario/datosIniciales.controller.js
/**
 * GET /api/inventario/datos-iniciales
 * =============================================================================
 * - KPIs (por moneda)
 * - Opciones de filtros (sitios/proyectos con apartados + todos)
 * - ubicaciones_almacen
 */

const pool = require("../../db/pool");
const { respond500 } = require("./helpers");

const getDatosIniciales = async (req, res) => {
  try {
    const kpiSkuQuery = `
      SELECT COUNT(DISTINCT material_id)::int AS kpi_skus
      FROM public.inventario_actual
      WHERE (COALESCE(stock_actual,0) + COALESCE(asignado,0)) > 0;
    `;

    const valorDisponibleQuery = `
      SELECT
        moneda,
        COALESCE(SUM(COALESCE(stock_actual,0) * COALESCE(ultimo_precio_entrada,0)), 0) AS valor_total
      FROM public.inventario_actual
      WHERE COALESCE(stock_actual,0) > 0
        AND COALESCE(ultimo_precio_entrada,0) > 0
        AND moneda IS NOT NULL
      GROUP BY moneda;
    `;

    const valorApartadoQuery = `
      SELECT
        moneda,
        COALESCE(SUM(COALESCE(cantidad,0) * COALESCE(valor_unitario,0)), 0) AS valor_total
      FROM public.inventario_asignado
      WHERE COALESCE(cantidad,0) > 0
        AND COALESCE(valor_unitario,0) > 0
        AND moneda IS NOT NULL
      GROUP BY moneda;
    `;

    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre
      FROM public.sitios s
      JOIN public.inventario_asignado ias ON s.id = ias.sitio_id
      WHERE COALESCE(ias.cantidad,0) > 0
      ORDER BY s.nombre ASC;
    `;

    const proyectosQuery = `
      SELECT DISTINCT p.id, p.nombre, p.sitio_id
      FROM public.proyectos p
      JOIN public.inventario_asignado ias ON p.id = ias.proyecto_id
      WHERE COALESCE(ias.cantidad,0) > 0
      ORDER BY p.nombre ASC;
    `;

    const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM public.proyectos ORDER BY nombre ASC;`;
    const todosSitiosQuery = `SELECT id, nombre FROM public.sitios ORDER BY nombre ASC;`;

    const ubicacionesAlmacenQuery = `
      SELECT id, codigo, nombre
      FROM public.ubicaciones_almacen
      ORDER BY id ASC;
    `;

    const [
      kpiSkuRes,
      valorDisponibleRes,
      valorApartadoRes,
      sitiosRes,
      proyectosRes,
      todosProyectosRes,
      todosSitiosRes,
      ubicacionesAlmacenRes,
    ] = await Promise.all([
      pool.query(kpiSkuQuery),
      pool.query(valorDisponibleQuery),
      pool.query(valorApartadoQuery),
      pool.query(sitiosQuery),
      pool.query(proyectosQuery),
      pool.query(todosProyectosQuery),
      pool.query(todosSitiosQuery),
      pool.query(ubicacionesAlmacenQuery),
    ]);

    return res.json({
      kpis: {
        kpi_skus: kpiSkuRes.rows[0]?.kpi_skus ?? 0,
        valores_disponibles: (valorDisponibleRes.rows || []).map((r) => ({
          moneda: r.moneda,
          valor_total: Number(r.valor_total || 0).toFixed(2),
        })),
        valores_apartados: (valorApartadoRes.rows || []).map((r) => ({
          moneda: r.moneda,
          valor_total: Number(r.valor_total || 0).toFixed(2),
        })),
      },
      filterOptions: {
        sitios: sitiosRes.rows || [],
        proyectos: proyectosRes.rows || [],
        todosSitios: todosSitiosRes.rows || [],
        todosProyectos: todosProyectosRes.rows || [],
        ubicacionesAlmacen: ubicacionesAlmacenRes.rows || [],
      },
    });
  } catch (error) {
    return respond500(res, "Error fetching initial data for /INV:", error);
  }
};

module.exports = { getDatosIniciales };
