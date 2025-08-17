const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Ajusta el path si tu pool está en otro lado

// Endpoint para obtener todos los proyectos activos
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.nombre, p.sitio_id, s.nombre as sitio_nombre
       FROM proyectos p
       LEFT JOIN sitios s ON p.sitio_id = s.id
       WHERE p.activo = true
       ORDER BY p.nombre ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({ error: 'Error obteniendo proyectos' });
  }
});


module.exports = router;
