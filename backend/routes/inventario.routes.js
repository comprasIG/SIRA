// backend/routes/inventario.routes.js
const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventario.controller');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

// Autenticación para todas las rutas
router.use(verifyFirebaseToken, loadSiraUser);



// --- ¡NUEVA RUTA PRINCIPAL DE DATOS! ---
// GET datos para KPIs (con valor) y Opciones de Filtros
router.get('/datos-iniciales', inventarioController.getDatosIniciales);

// GET lista principal de inventario (con filtros como query params)
router.get('/', inventarioController.getInventarioActual);

// GET detalle de asignaciones para un material específico (acción 'i')
router.get('/material/:materialId/asignaciones', inventarioController.getDetalleAsignacionesMaterial);

// GET kardex de movimientos para un material específico
router.get('/kardex', inventarioController.getKardex);

// POST para reversar un movimiento de inventario
router.post('/movimientos/:id/reversar', inventarioController.reversarMovimiento);

// POST para ajustar inventario (entradas/salidas)
router.post('/ajustes', inventarioController.ajustarInventario);

// POST para apartar stock general a un proyecto
router.post('/apartar', inventarioController.apartarStock);

// POST para mover una asignación existente entre proyectos/sitios
router.post('/mover-asignacion', inventarioController.moverAsignacion);

module.exports = router;