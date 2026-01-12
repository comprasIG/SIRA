// backend/controllers/inventario/listados.controller.js
/**
 * LISTADOS PRINCIPALES
 * =============================================================================
 * GET /api/inventario
 * GET /api/inventario/catalogo-resumen
 * GET /api/inventario/material/:materialId/asignaciones
 */

const pool = require("../../db/pool");
const { respond500 } = require("./helpers");

/**
 * GET /api/inventario
 * Lista principal (solo existentes), 1 fila por material (agregado).
 * Query:
 * - estado: TODOS | DISPONIBLE | APARTADO
 * - sitioId / proyectoId: filtra por apartados (inventario_asignado)
 * - search: palabras por nombre
 */
const getInventarioActual = async (req, res) => {
  const { estado = "TODOS", sitioId, proyectoId, search } = req.query;

  const params = [];
  let i = 1;

  let sql = `
    SELECT
      ia.material_id,
      cm.sku,
      cm.nombre AS material_nombre,
      cu.simbolo AS unidad_simbolo,

      COALESCE(SUM(ia.stock_actual), 0) AS total_stock,
      COALESCE(SUM(ia.asignado), 0) AS total_asignado,
      (COALESCE(SUM(ia.stock_actual), 0) + COALESCE(SUM(ia.asignado), 0)) AS total_existencia

    FROM public.inventario_actual ia
    JOIN public.catalogo_materiales cm ON cm.id = ia.material_id
    JOIN public.catalogo_unidades cu ON cu.id = cm.unidad_de_compra
  `;

  const where = [];
  const having = [];

  if (search) {
    const words = search
      .split(" ")
      .map((w) => w.trim())
      .filter(Boolean);
    for (const w of words) {
      where.push(`unaccent(cm.nombre) ILIKE unaccent($${i++})`);
      params.push(`%${w}%`);
    }
  }

  if ((estado === "TODOS" || estado === "APARTADO") && (sitioId || proyectoId)) {
    let sub = `
      ia.material_id IN (
        SELECT DISTINCT ia2.material_id
        FROM public.inventario_asignado ias
        JOIN public.inventario_actual ia2 ON ia2.id = ias.inventario_id
        WHERE COALESCE(ias.cantidad,0) > 0
    `;

    if (sitioId) {
      sub += ` AND ias.sitio_id = $${i++}`;
      params.push(sitioId);
    }
    if (proyectoId) {
      sub += ` AND ias.proyecto_id = $${i++}`;
      params.push(proyectoId);
    }

    sub += `)`;
    where.push(sub);
  }

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` GROUP BY ia.material_id, cm.sku, cm.nombre, cu.simbolo`;

  if (estado === "DISPONIBLE") having.push(`COALESCE(SUM(ia.stock_actual),0) > 0`);
  if (estado === "APARTADO") having.push(`COALESCE(SUM(ia.asignado),0) > 0`);
  if (having.length) sql += ` HAVING ${having.join(" AND ")}`;

  sql += ` ORDER BY cm.nombre ASC`;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    return respond500(res, "Error fetching inventory list:", error);
  }
};

/**
 * GET /api/inventario/catalogo-resumen
 * Devuelve TODO el catálogo de materiales ACTIVOS, aunque no exista en inventario_actual.
 * Ideal para ajustes (alta inicial / stock en ceros).
 */
const getCatalogoResumen = async (req, res) => {
  const { estado = "TODOS", sitioId, proyectoId, search } = req.query;

  const params = [];
  let i = 1;

  let sql = `
    SELECT
      cm.id AS material_id,
      cm.sku,
      cm.nombre AS material_nombre,
      cu.simbolo AS unidad_simbolo,

      COALESCE(SUM(ia.stock_actual), 0) AS total_stock,
      COALESCE(SUM(ia.asignado), 0) AS total_asignado,
      (COALESCE(SUM(ia.stock_actual), 0) + COALESCE(SUM(ia.asignado), 0)) AS total_existencia

    FROM public.catalogo_materiales cm
    JOIN public.catalogo_unidades cu ON cu.id = cm.unidad_de_compra
    LEFT JOIN public.inventario_actual ia ON ia.material_id = cm.id
  `;

  const where = [`cm.activo IS TRUE`];
  const having = [];

  if (search) {
    const words = search
      .split(" ")
      .map((w) => w.trim())
      .filter(Boolean);
    for (const w of words) {
      where.push(`unaccent(cm.nombre) ILIKE unaccent($${i++})`);
      params.push(`%${w}%`);
    }
  }

  if ((estado === "TODOS" || estado === "APARTADO") && (sitioId || proyectoId)) {
    let sub = `
      cm.id IN (
        SELECT DISTINCT ia2.material_id
        FROM public.inventario_asignado ias
        JOIN public.inventario_actual ia2 ON ia2.id = ias.inventario_id
        WHERE COALESCE(ias.cantidad,0) > 0
    `;

    if (sitioId) {
      sub += ` AND ias.sitio_id = $${i++}`;
      params.push(sitioId);
    }
    if (proyectoId) {
      sub += ` AND ias.proyecto_id = $${i++}`;
      params.push(proyectoId);
    }

    sub += `)`;
    where.push(sub);
  }

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` GROUP BY cm.id, cm.sku, cm.nombre, cu.simbolo`;

  if (estado === "DISPONIBLE") having.push(`COALESCE(SUM(ia.stock_actual),0) > 0`);
  if (estado === "APARTADO") having.push(`COALESCE(SUM(ia.asignado),0) > 0`);
  if (having.length) sql += ` HAVING ${having.join(" AND ")}`;

  sql += ` ORDER BY cm.nombre ASC`;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    return respond500(
      res,
      "Error fetching catalogo-resumen:",
      error,
      "Error al cargar el catálogo resumen."
    );
  }
};

/**
 * GET /api/inventario/material/:materialId/asignaciones
 * Devuelve filas de inventario_asignado > 0 para ese material.
 */
const getDetalleAsignacionesMaterial = async (req, res) => {
  const { materialId } = req.params;

  try {
    const sql = `
      SELECT
        ias.id AS asignacion_id,
        ia.material_id,
        ias.inventario_id,
        ias.requisicion_id,
        ias.proyecto_id,
        p.nombre AS proyecto_nombre,
        ias.sitio_id,
        s.nombre AS sitio_nombre,
        ias.cantidad,
        ias.valor_unitario,
        ias.moneda,
        ias.asignado_en
      FROM public.inventario_asignado ias
      JOIN public.inventario_actual ia ON ia.id = ias.inventario_id
      JOIN public.proyectos p ON p.id = ias.proyecto_id
      JOIN public.sitios s ON s.id = ias.sitio_id
      WHERE ia.material_id = $1
        AND COALESCE(ias.cantidad,0) > 0
      ORDER BY p.nombre ASC, s.nombre ASC, ias.id ASC;
    `;

    const { rows } = await pool.query(sql, [materialId]);
    return res.json(rows || []);
  } catch (error) {
    return respond500(res, `Error fetching assignments for material ${materialId}:`, error);
  }
};

module.exports = {
  getInventarioActual,
  getCatalogoResumen,
  getDetalleAsignacionesMaterial,
};
