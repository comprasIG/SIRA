// backend/routes/ingreso.routes.js
const express = require('express');
const router = express.Router();
const ingresoController = require('../controllers/ingreso.controller');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

// Apply authentication middleware to all routes in this file
router.use(verifyFirebaseToken, loadSiraUser);

// GET OCs that are currently 'EN_PROCESO' with filtering
router.get('/ocs-en-proceso', ingresoController.getOcsEnProceso);

// GET initial data for KPIs and Filter dropdowns
router.get('/datos-iniciales', ingresoController.getDatosIniciales);

// GET details (line items) for a specific OC to populate the income modal
router.get('/oc/:id/detalles', ingresoController.getOcDetalleParaIngreso);

// POST Register the actual income (full or partial)
router.post('/registrar', ingresoController.registrarIngreso);

module.exports = router;