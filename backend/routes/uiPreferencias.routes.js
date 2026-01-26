// C:\SIRA\backend\routes\uiPreferencias.routes.js
/**
 * ================================================================================================
 * ROUTES: UI Preferencias
 * ================================================================================================
 * Endpoints:
 *  - GET /api/ui-preferencias
 *  - PUT /api/ui-preferencias
 *
 * Requiere:
 *  - verifyFirebaseToken
 *  - loadSiraUser
 * ================================================================================================
 */

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

const {
  getUiPreferencias,
  upsertUiPreferencias,
} = require('../controllers/uiPreferencias.controller');

// Auth
router.use(verifyFirebaseToken);
router.use(loadSiraUser);

// Routes
router.get('/', getUiPreferencias);
router.put('/', upsertUiPreferencias);

module.exports = router;
