// C:\SIRA\backend\routes\finanzas\pagosOC.routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const loadSiraUser = require("../../middleware/loadSiraUser");

const pagosOCController = require('../../controllers/finanzas/pagosOC.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyFirebaseToken, loadSiraUser);

/**
 * Lista todos los pagos de una OC
 * GET /api/finanzas/oc/:id/pagos
 */
router.get('/oc/:id/pagos', pagosOCController.listarPagos);

/**
 * Registra un pago de OC (subida de comprobante)
 * POST /api/finanzas/oc/:id/pagos
 * (field: comprobante)
 */
router.post('/oc/:id/pagos', upload.single('comprobante'), pagosOCController.registrarPago);

module.exports = router;
