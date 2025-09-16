// C:\SIRA\backend\routes\finanzas.routes.js

const express = require('express');
const router = express.Router();
const autorizacionOCController = require('../controllers/finanzas/autorizacionOC.controller');

/**
 * @route POST /api/finanzas/oc/:id/aprobar-credito
 * @description Autoriza una Orden de Compra bajo la modalidad de crédito.
 * @access Privado (Finanzas)
 */
router.post(
    '/oc/:id/aprobar-credito',
    autorizacionOCController.aprobarCredito
);

// Aquí agregaremos más rutas de finanzas en el futuro...

module.exports = router;