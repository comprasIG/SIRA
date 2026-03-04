const express = require('express');
const router = express.Router();
// Ajusta la ruta hacia donde hayas guardado tu controlador
const catalogosController = require('../../controllers/empleados/catalogoController'); 

// Ruta principal que devuelve todos los catálogos en una sola petición
// GET /api/catalogos
router.get('/', catalogosController.obtenerTodosLosCatalogos);

module.exports = router;