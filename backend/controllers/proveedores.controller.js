// C:\SIRA\backend\controllers\proveedores.controller.js

const pool = require("../db/pool");

/**
 * Busca proveedores por término de búsqueda para autocompletado.
 */
const getProveedores = async (req, res) => {
  try {
    const searchTerm = req.query.query || '';
    if (!searchTerm) {
      return res.json([]);
    }

    // <-- VERIFICA ESTA LÍNEA: Debe seleccionar 'marca as nombre'
    const query = `
      SELECT id, marca as nombre, razon_social
      FROM proveedores
      WHERE unaccent(LOWER(marca)) LIKE unaccent(LOWER($1))
      ORDER BY marca ASC
      LIMIT 20;
    `;
    const values = [`%${searchTerm}%`];

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al buscar proveedores:", error);
    res.status(500).json({ error: "Error interno al buscar proveedores." });
  }
};

module.exports = {
  getProveedores,
};