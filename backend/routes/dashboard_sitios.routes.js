//C:\SIRA\backend\routes\dashboard_sitios.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboard_sitios.controller');

// Obtener KPIs
router.get('/kpis', controller.getKpis);

// Obtener tabla principal (Dashboard)
router.get('/', controller.getDashboardData);

// Obtener lista simple de clientes para selects
router.get('/clientes-list', controller.getClientesList);

// Crear sitio
router.post('/', controller.createSitio);

// Crear cliente
router.post('/cliente', controller.createCliente);

module.exports = router;