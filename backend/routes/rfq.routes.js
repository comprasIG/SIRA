// C:\SIRA\backend\routes\rfq.routes.js
/**
 * =================================================================================================
 * RUTAS: Solicitudes de Cotización (RFQs)
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rfqController = require("../controllers/rfq.controller");

// Configuración de Multer para manejar archivos en memoria.
const upload = multer({ storage: multer.memoryStorage() });

// Aplica middlewares de autenticación a todas las rutas de este archivo.
router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas para obtener listas ---
router.get("/pendientes", rfqController.getRequisicionesCotizando);
router.get("/por-aprobar", rfqController.getRfqsPorAprobar);

// --- Rutas para acciones sobre un RFQ específico ---
router.get("/:id", rfqController.getRfqDetalle);
router.post("/:id/opciones", upload.any(), rfqController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", rfqController.enviarRfqAprobacion);
router.post("/:id/cancelar", rfqController.cancelarRfq);
router.post("/:id/rechazar", rfqController.rechazarRfq);

// --- Ruta principal para la acción del Gerente/Aprobador ---
router.post("/:id/generar-ocs", rfqController.generarOcsDesdeRfq);

module.exports = router;