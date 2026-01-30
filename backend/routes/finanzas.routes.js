// C:\SIRA\backend\routes\finanzas.routes.js
const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const {
  getOcsPorAutorizar,
  listSpeiPorConfirmar,
  listOcsPorLiquidar,
  listOcsEnHold,                // NUEVO
  preautorizarSpei,
  cancelarSpei,
  aprobarCredito,
  getDetallesCredito,
  rechazarOC,
  ponerHoldOC,
  reanudarDesdeHold,
  getOcPreview,
  cancelarOC,
} = require('../controllers/finanzas/autorizacionOC.controller');

router.use(verifyFirebaseToken, loadSiraUser);

// Listas
router.get('/ocs/por-autorizar', getOcsPorAutorizar);
router.get('/ocs/confirmar-spei', listSpeiPorConfirmar);
router.get('/ocs/por-liquidar', listOcsPorLiquidar);
router.get('/ocs/en-hold', listOcsEnHold); // NUEVA

// Acciones SPEI
router.post('/oc/:id/preautorizar-spei', preautorizarSpei);
router.post('/oc/:id/cancelar-spei', cancelarSpei);

// Crédito
router.get('/oc/:id/detalles-credito', getDetallesCredito);
router.post('/oc/:id/aprobar-credito', aprobarCredito);

// Rechazo / Hold / Preview
router.post('/oc/:id/rechazar', rechazarOC);
router.post('/oc/:id/hold', ponerHoldOC);
router.post('/oc/:id/reanudar', reanudarDesdeHold);
router.post('/oc/:id/cancelar', cancelarOC);
router.get('/oc/:id/preview', getOcPreview);

module.exports = router;
