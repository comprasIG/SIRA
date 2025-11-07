// C:\SIRA\backend\routes\rfq.routes.js
/**
 * =================================================================================================
 * RUTAS: Solicitudes de Cotización (RFQs)
 * Montado desde app.js en: /api/rfq
 * - Si un handler no existe, Express/Node lanzará error (comportamiento intencional).
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");

// Desde /routes → subir un nivel a /middleware y /controllers
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// Controladores RFQ
const genController = require("../controllers/rfq/generacion.controller");
const vbController  = require("../controllers/rfq/vistoBueno.controller");

// (Opcional) Borradores de RFQ — si NO tienes este módulo, elimina estas dos rutas.
let borradorController;
try {
  borradorController = require("../controllers/rfq/borradores.rfq.controller");
} catch (err) {
  // Si quieres que falle cuando no exista, elimina este try/catch y require directamente.
  borradorController = null;
}

// Subida de archivos en memoria (ajusta límites si lo requieres)
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares globales para todo el router
router.use(verifyFirebaseToken, loadSiraUser);

/* ------------------------------ Listados ------------------------------ */
router.get("/pendientes", genController.getRequisicionesCotizando);
router.get("/por-aprobar", vbController.getRfqsPorAprobar);

/* ------------------------------ Borradores ---------------------------- */
if (borradorController) {
  router.get("/:id/borrador", borradorController.getMiBorradorRfq);
  router.post("/:id/borrador", borradorController.upsertMiBorradorRfq);
}

/* -------------------- Acciones de GENERACIÓN (Comprador) -------------- */
router.post("/:id/opciones", upload.any(), genController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", genController.enviarAAprobacion); // ✅ nombre correcto
router.post("/:id/cancelar", genController.cancelarRfq);

/* ------------------ Acciones de VISTO BUENO (Gerente) ----------------- */
router.post("/:id/rechazar", vbController.rechazarRfq);
router.post("/:id/generar-ocs", vbController.generarOcsDesdeRfq);

/* ------------------------------ Utilidad ------------------------------ */
// Si tienes el export controller, deja estas dos líneas; si no, quítalas para evitar crash por módulo faltante.
const exportController = require("../controllers/rfq/export.controller");
router.get("/:id/exportar-excel", exportController.exportRfqToExcel);

/* ------------------------------ Detalle ------------------------------ */
// Mantén al final para no colisionar con rutas más específicas.
router.get("/:id", genController.getRfqDetalle);

module.exports = router;
