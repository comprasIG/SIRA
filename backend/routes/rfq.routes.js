// C:\SIRA\backend\routes\rfq.routes.js
/**
 * =================================================================================================
 * RUTAS: Solicitudes de Cotización (RFQs) (Con Rutas de Borrador)
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const genController = require('../controllers/rfq/generacion.controller');
const vbController = require('../controllers/rfq/vistoBueno.controller');

// =================================================================
// --- CORRECCIÓN: Añadir la importación que faltaba ---
const borradorController = require('../controllers/rfq/borradores.rfq.controller');
// =================================================================

const upload = multer({ storage: multer.memoryStorage() });
router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas de Listado ---
router.get("/pendientes", genController.getRequisicionesCotizando);
router.get("/por-aprobar", vbController.getRfqsPorAprobar);

// =================================================================
// --- NUEVO: Rutas de Borrador (Snapshot) ---
// Deben ir ANTES de /:id para que "borrador" no sea capturado como un ID
// =================================================================
router.get("/:id/borrador", borradorController.getMiBorradorRfq);
router.post("/:id/borrador", borradorController.upsertMiBorradorRfq);
// =================================================================

// --- Rutas de Acción de GENERACIÓN (Comprador) ---
router.post("/:id/opciones", upload.any(), genController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", genController.enviarRfqAprobacion);
router.post("/:id/cancelar", genController.cancelarRfq);

// --- Rutas de Acción de VISTO BUENO (Gerente) ---
router.post("/:id/rechazar", vbController.rechazarRfq);
router.post("/:id/generar-ocs", vbController.generarOcsDesdeRfq);

// --- Rutas de Utilidad ---
const exportController = require('../controllers/rfq/export.controller');
router.get('/:id/exportar-excel', exportController.exportRfqToExcel);

// --- Ruta genérica de DETALLE (Debe ir al final) ---
router.get("/:id", genController.getRfqDetalle);

module.exports = router;