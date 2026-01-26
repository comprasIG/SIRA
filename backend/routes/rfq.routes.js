// C:\SIRA\backend\routes\rfq.routes.js
/**
 * =================================================================================================
 * RUTAS: Solicitudes de Cotización (RFQs)
 * - Listado (pendientes / por aprobar)
 * - Borradores (snapshot por requisición)
 * - Acciones (guardar opciones, enviar a aprobación, cancelar)
 * - Visto Bueno (rechazar, generar OCs)
 * - Utilidades (exportar excel)
 * - Ordenamiento de líneas (drag & drop)  ✅ NUEVO
 * - Detalle (/:id)  (SIEMPRE AL FINAL)
 * =================================================================================================
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");

const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const genController = require("../controllers/rfq/generacion.controller");
const vbController = require("../controllers/rfq/vistoBueno.controller");
const borradorController = require("../controllers/rfq/borradores.rfq.controller");
const exportController = require("../controllers/rfq/export.controller");

// ================================================================================================
// Middleware global (auth + usuario SIRA)
// ================================================================================================
router.use(verifyFirebaseToken, loadSiraUser);

// ================================================================================================
// Config de uploads (cotizaciones / adjuntos)
// ================================================================================================
const upload = multer({ storage: multer.memoryStorage() });

// ================================================================================================
// Listados
// ================================================================================================
router.get("/pendientes", genController.getRequisicionesCotizando);
router.get("/por-aprobar", vbController.getRfqsPorAprobar);

// ================================================================================================
// Borradores (Snapshot)
// IMPORTANTE: antes de "/:id" para que "borrador" no sea interpretado como id.
// ================================================================================================
router.get("/:id/borrador", borradorController.getMiBorradorRfq);
router.post("/:id/borrador", borradorController.upsertMiBorradorRfq);

// ================================================================================================
// Acciones (Comprador)
// ================================================================================================
router.post("/:id/opciones", upload.any(), genController.guardarOpcionesRfq);
router.post("/:id/enviar-a-aprobacion", genController.enviarRfqAprobacion);
router.post("/:id/cancelar", genController.cancelarRfq);

// ================================================================================================
// ✅ NUEVO: Ordenamiento de líneas (Drag & Drop)
// Debe ir antes de "/:id" para no ser capturado por la ruta genérica.
// ================================================================================================
router.put("/:id/materiales/orden", genController.updateRfqMaterialOrder);

// ================================================================================================
// Acciones (Visto Bueno / Gerente)
// ================================================================================================
router.post("/:id/rechazar", vbController.rechazarRfq);
router.post("/:id/generar-ocs", vbController.generarOcsDesdeRfq);

// ================================================================================================
// Utilidades
// ================================================================================================
router.get("/:id/exportar-excel", exportController.exportRfqToExcel);

// ================================================================================================
// Detalle (SIEMPRE al final)
// ================================================================================================
router.get("/:id", genController.getRfqDetalle);

module.exports = router;
