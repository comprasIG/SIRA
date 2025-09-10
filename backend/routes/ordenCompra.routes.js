//C:\SIRA\backend\routes\ordenCompra.routes.js
/**
 * =================================================================================================
 * RUTAS: Órdenes de Compra (OC)
 * =================================================================================================
 * @file ordenCompra.routes.js
 * @description Define los endpoints de la API para las operaciones con Órdenes de Compra.
 */

const express = require("express");
const router = express.Router();
const ocController = require("../controllers/ordenCompra.controller");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

router.use(verifyFirebaseToken, loadSiraUser);

/**
 * @route   POST /api/ocs/rfq/:rfqId/generar-oc
 * @desc    Genera el registro de una OC en la BD con estado 'POR_AUTORIZAR'.
 * @access  Privado
 */
router.post(
    "/rfq/:rfqId/generar-oc",
    ocController.generarOrdenDeCompra
);

/**
 * ===============================================================================================
 * --- ¡NUEVA RUTA! ---
 * ===============================================================================================
 * @route   POST /api/ocs/:id/autorizar
 * @desc    Ejecuta el flujo completo de autorización para una OC (PDF, Drive, Email).
 * @access  Privado
 */
router.post(
    "/:id/autorizar", // Recibe el ID de la OC como parámetro en la URL.
    ocController.autorizarOrdenDeCompra
);

router.get("/:id/pdf", ocController.descargarOcPdf);


module.exports = router;