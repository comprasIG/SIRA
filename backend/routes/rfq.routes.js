// C:\SIRA\backend\routes\rfq.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rfqController = require("../controllers/rfq.controller");

router.use(verifyFirebaseToken, loadSiraUser);

// --- CORRECCIÓN: Rutas específicas primero ---
router.get("/pendientes", rfqController.getRequisicionesCotizando);
router.get("/por-aprobar", rfqController.getRfqsPorAprobar); // <-- Esta ahora está antes de /:id

// --- Rutas genéricas con :id después ---
router.get("/:id", rfqController.getRfqDetalle);
router.post("/:id/opciones", rfqController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", rfqController.enviarRfqAprobacion);
router.post("/:id/cancelar", rfqController.cancelarRfq);
router.post("/:id/aprobar", rfqController.aprobarRfqYGenerarOC);
router.post("/:id/rechazar", rfqController.rechazarRfq);

module.exports = router;