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

    // Usamos unaccent para ignorar acentos y ILIKE para case-insensitive
    const query = `
      SELECT id, razon_social as nombre
      FROM proveedores
      WHERE unaccent(LOWER(razon_social)) LIKE unaccent(LOWER($1))
      ORDER BY razon_social ASC
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