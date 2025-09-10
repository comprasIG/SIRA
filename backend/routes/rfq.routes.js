// C:\SIRA\backend\routes\rfq.routes.js
/**
 * =================================================================================================
 * RUTAS: Solicitudes de Cotización (RFQs) (Con Orden Corregido)
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const genController = require('../controllers/rfq/generacion.controller');
const vbController = require('../controllers/rfq/vistoBueno.controller');

const upload = multer({ storage: multer.memoryStorage() });
router.use(verifyFirebaseToken, loadSiraUser);

// --- ¡CORRECCIÓN! Rutas específicas primero ---
router.get("/pendientes", genController.getRequisicionesCotizando);
router.get("/por-aprobar", vbController.getRfqsPorAprobar);

// --- Rutas que pertenecen al controlador de GENERACIÓN (Comprador) ---
router.post("/:id/opciones", upload.any(), genController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", genController.enviarRfqAprobacion);
router.post("/:id/cancelar", genController.cancelarRfq);

// --- Rutas que pertenecen al controlador de VISTO BUENO (Gerente) ---
router.post("/:id/rechazar", vbController.rechazarRfq);
router.post("/:id/generar-ocs", vbController.generarOcsDesdeRfq);

// --- ¡CORRECCIÓN! La ruta genérica con :id va al final ---
router.get("/:id", genController.getRfqDetalle);

module.exports = router;