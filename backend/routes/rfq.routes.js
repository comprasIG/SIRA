// C:\SIRA\backend\routes\rfq.routes.js

// C:\SIRA\backend\routes\rfq.routes.js

const express = require("express");
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rfqController = require("../controllers/rfq.controller");

// --- CORRECCIÓN: Se ajusta multer para manejar múltiples campos de archivo dinámicos ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas específicas primero ---
router.get("/pendientes", rfqController.getRequisicionesCotizando);
router.get("/por-aprobar", rfqController.getRfqsPorAprobar);

// --- Rutas genéricas con :id después ---
router.get("/:id", rfqController.getRfqDetalle);

// --- CORRECCIÓN: Se usa upload.any() para aceptar archivos de campos con nombres variables ---
router.post("/:id/opciones", upload.any(), rfqController.guardarOpcionesRfq);

router.post("/:id/enviar-a-aprobacion", rfqController.enviarRfqAprobacion);
router.post("/:id/cancelar", rfqController.cancelarRfq);
router.post("/:id/aprobar", rfqController.aprobarRfqYGenerarOC);
router.post("/:id/rechazar", rfqController.rechazarRfq);

module.exports = router;