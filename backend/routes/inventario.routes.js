// backend/routes/inventario.routes.js
const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventario.controller');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

// Autenticación para todas las rutas
router.use(verifyFirebaseToken, loadSiraUser);

// GET datos para los filtros de la página principal
router.get('/datos-filtros', inventarioController.getDatosFiltrosInventario);

// GET lista principal de inventario (con filtros como query params)
router.get('/', inventarioController.getInventarioActual);

// GET detalle de asignaciones para un material específico (acción 'i')
router.get('/material/:materialId/asignaciones', inventarioController.getDetalleAsignacionesMaterial);

// POST para apartar stock general a un proyecto
router.post('/apartar', inventarioController.apartarStock);

// POST para mover una asignación existente entre proyectos/sitios
router.post('/mover-asignacion', inventarioController.moverAsignacion);

module.exports = router;