// C:\SIRA\backend\routes\finanzas.routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const autorizacionOCController = require('../controllers/finanzas/autorizacionOC.controller');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const upload = multer({ storage: multer.memoryStorage() });
router.use(verifyFirebaseToken, loadSiraUser);
/**
 * @route POST /api/finanzas/oc/:id/aprobar-credito
 * @description Autoriza una Orden de Compra bajo la modalidad de crédito.
 * @access Privado (Finanzas)
 */
router.get('/oc/:id/detalles-credito', autorizacionOCController.getDetallesCredito);
router.get('/ocs/por-autorizar',autorizacionOCController.getOcsPorAutorizar);
router.post('/oc/:id/aprobar-credito',autorizacionOCController.aprobarCredito);
router.post('/oc/:id/preautorizar-spei',autorizacionOCController.preautorizarSpei);
router.post('/oc/:id/confirmar-spei',upload.single('comprobante'),autorizacionOCController.confirmarSpeiConComprobante);

// Aquí agregaremos más rutas de finanzas en el futuro...

module.exports = router;