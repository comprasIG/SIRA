//C:\SIRA\backend\routes\dashboard_sitios.routes
const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboard_sitios.controller');

// Obtener KPIs para la parte superior de la página
router.get('/kpis', controller.getKpis);

// Obtener listado principal con datos enriquecidos (Sitios + Clientes + Totales)
router.get('/', controller.getDashboardData);

// Crear un nuevo sitio
router.post('/', controller.createSitio);

// Crear un nuevo cliente (acción rápida)
router.post('/cliente', controller.createCliente);

module.exports = router; 