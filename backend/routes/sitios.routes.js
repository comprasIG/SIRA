//C:\SIRA\backend\routes\sitios.routes.js

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre FROM sitios ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener sitios:', error);
    res.status(500).json({ error: 'Error obteniendo sitios' });
  }
});

module.exports = router;
