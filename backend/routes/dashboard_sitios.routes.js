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

// Totales de OC por sitio (agrupados por moneda)
router.get('/oc-totales-por-sitio', controller.getOCTotalesPorSitio);

// Proyectos por sitio
router.get('/:sitioId/proyectos', controller.getProyectosPorSitio);


// Crear sitio
router.post('/', controller.createSitio);

// Crear cliente
router.post('/cliente', controller.createCliente);


// Toggle activo
router.patch('/:id/toggle-activo', controller.toggleActivoSitio);


module.exports = router;