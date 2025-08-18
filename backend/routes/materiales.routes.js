const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query) {
      const result = await pool.query('SELECT id, nombre FROM catalogo_materiales ORDER BY nombre LIMIT 10');
      return res.json(result.rows);
    }

    const palabras = query.toLowerCase().split(/\s+/).filter(Boolean);
    let where = palabras.map((_, i) => `unaccent(LOWER(nombre)) ~* $${i + 1}`).join(' AND ');
    let valores = palabras.map(palabra => `\\y${palabra}\\y`);

    const sql = `
      SELECT id, nombre 
      FROM catalogo_materiales
      WHERE ${where}
      ORDER BY nombre ASC
      LIMIT 50
    `;
/*
    // --- INICIO DE CÓDIGO DE DIAGNÓSTICO ---
    // Estas líneas imprimirán en tu consola del servidor la consulta exacta que se está ejecutando.
    console.log('--- NUEVA BÚSQUEDA ---');
    console.log('Término de búsqueda:', query);
    console.log('SQL generado:', sql);
    console.log('Valores:', valores);
    // --- FIN DE CÓDIGO DE DIAGNÓSTICO ---
*/
    const result = await pool.query(sql, valores);
    
    // Si la búsqueda fue exitosa, también lo mostraremos
    //console.log('Resultados encontrados:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    // Si hay un error, lo veremos claramente aquí
    console.error('!!!!!!!! ERROR EN LA BÚSQUEDA !!!!!!!!:', error);
    res.status(500).json({ error: 'Error buscando materiales' });
  
    }
    
});

module.exports = router;