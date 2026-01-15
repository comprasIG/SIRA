const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Asegúrate de que esta ruta sea correcta

// --- RUTA ORIGINAL PARA BÚSQUEDA GENERAL (SIN CAMBIOS) ---
router.get('/', async (req, res) => {
  try {
    const sku = req.query.sku ? req.query.sku.trim() : '';
    if (sku) {
      const sql = `
        SELECT id, nombre, sku
        FROM catalogo_materiales
        WHERE LOWER(sku) LIKE LOWER($1)
        ORDER BY sku ASC
        LIMIT 50
      `;
      const result = await pool.query(sql, [`%${sku}%`]);
      return res.json(result.rows);
    }

    const query = req.query.query || '';
    if (!query) {
      return res.json([]);
    }

    const palabras = query.toLowerCase().split(/\s+/).filter(Boolean);
    let where = palabras.map((_, i) => `unaccent(LOWER(nombre)) ~* $${i + 1}`).join(' AND ');
    let valores = palabras.map(palabra => `\\y${palabra}\\y`);

    const sql = `
      SELECT id, nombre, sku
      FROM catalogo_materiales
      WHERE ${where}
      ORDER BY nombre ASC
      LIMIT 50
    `;
    
    const result = await pool.query(sql, valores);
    res.json(result.rows);
    
  } catch (error) {
    console.error('ERROR EN LA BÚSQUEDA DE MATERIALES:', error);
    res.status(500).json({ error: 'Error buscando materiales' });
  }
});

// --- RUTA CORREGIDA PARA OBTENER UN MATERIAL POR SU ID ---
// Responde a peticiones como GET /api/materiales/76
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'El ID del material debe ser un número.' });
  }

  try {
    // --- MEJORA CLAVE: Se usa un JOIN para obtener el símbolo de la unidad ---
    const sql = `
      SELECT
        m.id,
        m.nombre,
        u.simbolo AS unidad 
      FROM public.catalogo_materiales AS m
      JOIN public.catalogo_unidades AS u ON m.unidad_de_compra = u.id
      WHERE m.id = $1
    `;
    
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Material con ID ${id} no encontrado.` });
    }

    // Devuelve el material con la propiedad 'unidad' conteniendo el símbolo (ej. 'PZA')
    res.json(result.rows[0]);

  } catch (error) {
    console.error(`ERROR AL OBTENER MATERIAL CON ID ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
