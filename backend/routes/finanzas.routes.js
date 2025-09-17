// C:\SIRA\backend\routes\finanzas.routes.js

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const {
  getOcsPorAutorizar,
  preautorizarSpei,
  cancelarSpei,
  aprobarCredito,
  getDetallesCredito,
  listSpeiPorConfirmar,
  listOcsPorLiquidar,
} = require('../controllers/finanzas/autorizacionOC.controller');

router.use(verifyFirebaseToken, loadSiraUser);

// Listas
router.get('/ocs/por-autorizar', getOcsPorAutorizar);
router.get('/ocs/confirmar-spei', listSpeiPorConfirmar);
router.get('/ocs/por-liquidar', listOcsPorLiquidar);

// Acciones SPEI
router.post('/oc/:id/preautorizar-spei', preautorizarSpei);
router.post('/oc/:id/cancelar-spei', cancelarSpei);

// Crédito
router.get('/oc/:id/detalles-credito', getDetallesCredito);
router.post('/oc/:id/aprobar-credito', aprobarCredito);

module.exports = router;
