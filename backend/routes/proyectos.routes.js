//C:\SIRA\backend\routes\proyectos.routes.js
const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Ajusta el path si tu pool está en otro lado

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const { crearProyecto, descargarProyectoPdf } = require('../controllers/g_proj.controller');

// GET /api/proyectos  - lista proyectos activos
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

// GET /api/proyectos/buscar  - autocomplete
router.get('/buscar', async (req, res) => {
  try {
    const { texto = '', sitio_id } = req.query;
    let query = `
      SELECT p.id, p.nombre, p.sitio_id, s.nombre as sitio_nombre
      FROM proyectos p
      LEFT JOIN sitios s ON p.sitio_id = s.id
      WHERE p.activo = true AND p.nombre ILIKE $1
    `;
    const params = [`%${texto}%`];
    if (sitio_id) {
      query += ` AND p.sitio_id = $2`;
      params.push(sitio_id);
    }
    query += ` ORDER BY p.nombre ASC LIMIT 20`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en búsqueda de proyectos:', error);
    res.status(500).json({ error: 'Error buscando proyectos' });
  }
});

// =========================================
//          NUEVO ENDPOINT G_PROJ
// =========================================

// GET /api/proyectos/:id/pdf - generar/descargar pdf (opcionalmente notificar por correo)
router.get(
  '/:id/pdf',
  verifyFirebaseToken,
  loadSiraUser,
  descargarProyectoPdf
);

// POST /api/proyectos  - crear nuevo proyecto
router.post(
  '/',
  verifyFirebaseToken,
  loadSiraUser,
  crearProyecto
);

module.exports = router;
