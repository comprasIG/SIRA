// C:\SIRA\backend\routes\requisiciones.routes.js
/**
 * =================================================================================================
 * RUTAS: Requisiciones (Con Orden Corregido)
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const genController = require('../controllers/requisiciones/generacion.controller');
const vbController = require('../controllers/requisiciones/vistoBueno.controller');

const upload = multer({ storage: multer.memoryStorage() });
router.use(verifyFirebaseToken, loadSiraUser);

// --- ¡CORRECCIÓN! Rutas específicas primero ---
router.get("/por-aprobar", vbController.getRequisicionesPorAprobar);

// --- Rutas de Generación y Edición ---
router.post("/", upload.array('archivosAdjuntos', 5), genController.crearRequisicion);
router.put("/:id", upload.array('archivosNuevos', 5), genController.actualizarRequisicion);

// --- Rutas de Visto Bueno (Aprobación) ---
router.post("/:id/aprobar-y-notificar", vbController.aprobarYNotificar);
router.post("/:id/rechazar", vbController.rechazarRequisicion);

// --- ¡CORRECCIÓN! La ruta genérica con :id va al final ---
router.get("/:id", genController.getRequisicionDetalle);

module.exports = router;