// backend/routes/retiro.routes.js
const express = require('express');
const router = express.Router();
const retiroController = require('../controllers/retiro.controller');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

// Autenticación para todas las rutas de retiro
router.use(verifyFirebaseToken, loadSiraUser);

// GET datos para llenar los filtros iniciales
router.get('/datos-filtros', retiroController.getDatosFiltrosRetiro);

// GET materiales asignados a un sitio y proyecto específico
router.get('/asignado/:sitioId/:proyectoId', retiroController.getMaterialesAsignados);

// GET stock disponible y ubicaciones para un material de stock general
router.get('/stock/:materialId', retiroController.getStockMaterial);

// POST para registrar el retiro (sea asignado o de stock)
router.post('/registrar', retiroController.registrarRetiro);

module.exports = router;