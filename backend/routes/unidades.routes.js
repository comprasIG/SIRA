// backend/routes/unidades.routes.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const unidadesController = require('../controllers/unidades.controller');

// Aplicamos middlewares de autenticación a TODAS las rutas de unidades
router.use(verifyFirebaseToken, loadSiraUser);

// GET /api/unidades
// Obtiene la lista principal de unidades (para el dashboard vehicular)
router.get('/', unidadesController.getUnidades);

// GET /api/unidades/:id/historial
// Obtiene la bitácora de una sola unidad
router.get('/:id/historial', unidadesController.getHistorialUnidad);

// POST /api/unidades/requisicion
// Crea la requisición vehicular (la llama el modal)
router.post('/requisicion', unidadesController.crearRequisicionVehicular);

module.exports = router;