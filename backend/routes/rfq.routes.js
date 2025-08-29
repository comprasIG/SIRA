// C:\SIRA\backend\routes\rfq.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rfqController = require("../controllers/rfq.controller");

router.use(verifyFirebaseToken, loadSiraUser);

router.get("/pendientes", rfqController.getRequisicionesCotizando);
router.get("/:id", rfqController.getRfqDetalle);
router.post("/:id/opciones", rfqController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", rfqController.enviarRfqAprobacion);

// <-- NUEVA RUTA
router.post("/:id/cancelar", rfqController.cancelarRfq);

module.exports = router;