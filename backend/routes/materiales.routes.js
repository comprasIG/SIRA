 const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Endpoint para buscar materiales por palabras (en cualquier orden)
router.get('/', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query) {
      // Si no mandan query, devuelve los primeros 10 materiales como sugerencia
      const result = await pool.query(
        'SELECT id, nombre FROM catalogo_materiales LIMIT 10'
      );
      return res.json(result.rows);
    }

    // Separar la búsqueda en palabras y construir condiciones LIKE
    const palabras = query.toLowerCase().split(/\s+/).filter(Boolean);

    // Construir el WHERE dinámicamente: cada palabra debe aparecer en el nombre
    let where = palabras.map((_, i) => `LOWER(nombre) LIKE $${i + 1}`).join(' AND ');
    let valores = palabras.map(palabra => `%${palabra}%`);

    const sql = `
      SELECT id, nombre 
      FROM catalogo_materiales
      WHERE ${where}
      ORDER BY nombre ASC
      LIMIT 20
    `;

    const result = await pool.query(sql, valores);
    res.json(result.rows);
  } catch (error) {
    console.error('Error buscando materiales:', error);
    res.status(500).json({ error: 'Error buscando materiales' });
  }
});

module.exports = router;
