const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Asegúrate de que esta ruta sea correcta

// --- RUTA ORIGINAL PARA BÚSQUEDA GENERAL (SIN CAMBIOS) ---
// --- RUTA MODIFICADA PARA BÚSQUEDA UNIFICADA (SKU O NOMBRE) Y FILTRO DE ACTIVOS ---
const { buildSearchConditions } = require('../utils/searchUtils');

// --- RUTA MODIFICADA PARA BÚSQUEDA UNIFICADA (SKU O NOMBRE) Y FILTRO DE ACTIVOS ---
router.get('/', async (req, res) => {
  try {
    const query = req.query.query ? req.query.query.trim() : '';

    // Si no hay query, retornamos vacío
    if (!query) {
      return res.json([]);
    }

    // Usamos la utilidad para generar condiciones
    const { whereClause, values } = buildSearchConditions(query, 'sku', 'nombre', 1);

    if (!whereClause) {
      return res.json([]);
    }

    // Construimos la consulta dinámica
    let sql = `
      SELECT id, nombre, sku
      FROM catalogo_materiales
      WHERE activo = true ${whereClause}
    `;

    // Ordenamiento:
    // Priorizamos si el primer término coincide exactamente con el inicio del SKU o Nombre
    // (Esto es una heurística simple, se puede refinar)
    sql += ` ORDER BY nombre ASC LIMIT 50`;

    const result = await pool.query(sql, values);

    res.json(result.rows);

  } catch (error) {
    console.error('ERROR EN LA BÚSQUEDA DE MATERIALES:', error);
    res.status(500).json({ error: 'Error buscando materiales' });
  }
});

// --- RUTA MODIFICADA PARA OBTENER UN MATERIAL POR ID CON STOCK ---
// Responde a peticiones como GET /api/materiales/76?proyecto_id=123
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { proyecto_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'El ID del material debe ser un número.' });
  }

  try {
    // 1. Obtener datos básicos del material + unidad
    const materialSql = `
      SELECT
        m.id,
        m.nombre,
        m.sku,
        m.cantidad_uso,
        m.unidad_uso_id,
        COALESCE(cu_uso.simbolo, u.simbolo) AS unidad,
        cu_uso.simbolo AS unidad_uso_simbolo,
        cu_uso.unidad  AS unidad_uso_nombre
      FROM public.catalogo_materiales AS m
      JOIN public.catalogo_unidades AS u ON m.unidad_de_compra = u.id
      LEFT JOIN public.catalogo_unidades AS cu_uso ON m.unidad_uso_id = cu_uso.id
      WHERE m.id = $1
    `;
    const materialResult = await pool.query(materialSql, [id]);

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ error: `Material con ID ${id} no encontrado.` });
    }

    const material = materialResult.rows[0];

    // 2. Calcular Stock General (Suma de inventario_actual en todas las ubicaciones)
    const stockSql = `
      SELECT COALESCE(SUM(stock_actual), 0) as stock_general
      FROM inventario_actual
      WHERE material_id = $1
    `;
    const stockResult = await pool.query(stockSql, [id]);
    material.stock_general = parseFloat(stockResult.rows[0].stock_general);

    // 3. Calcular Apartado para el Proyecto (Si se envía proyecto_id)
    if (proyecto_id && !isNaN(proyecto_id)) {
      const apartadoSql = `
        SELECT COALESCE(SUM(ia.cantidad), 0) as apartado_proyecto
        FROM inventario_asignado ia
        JOIN inventario_actual inv ON ia.inventario_id = inv.id
        WHERE inv.material_id = $1 AND ia.proyecto_id = $2
      `;
      const apartadoResult = await pool.query(apartadoSql, [id, proyecto_id]);
      material.apartado_proyecto = parseFloat(apartadoResult.rows[0].apartado_proyecto);
    } else {
      material.apartado_proyecto = 0;
    }

    res.json(material);

  } catch (error) {
    console.error(`ERROR AL OBTENER MATERIAL CON ID ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
