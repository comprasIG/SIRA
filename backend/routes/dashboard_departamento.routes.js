// C:\SIRA\backend\routes\dashboard_departamento.routes.js
/**
 * ============================================================================
 * SIRA - Rutas Dashboard por Departamento (NO Compras)
 * ----------------------------------------------------------------------------
 * Se monta en: /api/dashboard
 * Endpoint:
 *   GET /api/dashboard/departamento
 *
 * Mantiene el mismo stack de seguridad que dashboard.routes.js:
 *   verifyFirebaseToken + loadSiraUser
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

const {
  getDepartamentoDashboard,
} = require('../controllers/dashboard/departamentoDashboard.controller');

// Seguridad (igual que el dashboard actual)
router.use(verifyFirebaseToken, loadSiraUser);

// Endpoint único para TODOS los dashboards departamentales
router.get('/departamento', getDepartamentoDashboard);

module.exports = router;
