// C:\SIRA\backend\routes\requisiciones.routes.js
/**
 * =================================================================================================
 * RUTAS: Requisiciones
 * - El router se monta desde app.js en: /api/requisiciones
 * - ¡Importante! Las rutas internas aquí son RELATIVAS (sin /api/... al inicio).
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require('multer');

const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const { getMiBorrador, upsertMiBorrador, borrarMiBorrador } =
  require('../controllers/requisiciones/borradores.controller');

const genController = require('../controllers/requisiciones/generacion.controller');
const vbController = require('../controllers/requisiciones/vistoBueno.controller');
const editarComprasController = require('../controllers/requisiciones/editarCompras.controller');

// Carga de archivos en memoria (ajusta límites si lo requieres)
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares de auth/carga de usuario para TODO el router
router.use(verifyFirebaseToken, loadSiraUser);

/* -------------------------- Rutas específicas primero -------------------------- */
// Visto bueno: lista por aprobar (ejemplo)
router.get("/por-aprobar", vbController.getRequisicionesPorAprobar);

/* --------------------------------- Borradores --------------------------------- */
router.get('/borrador/mio', getMiBorrador);
router.post('/borrador', upsertMiBorrador);
router.delete('/borrador', borrarMiBorrador);

/* ------------------------ Generación y edición (CRUD) ------------------------- */
router.post("/", upload.array('archivosAdjuntos', 5), genController.crearRequisicion);
router.put("/:id", upload.array('archivosNuevos', 5), genController.actualizarRequisicion);

/* ------------- Edición restringida y regeneración PDF (Compras) -------------- */
router.get("/:id/proteccion-oc", editarComprasController.obtenerProteccionOC);
router.patch("/:id/editar-compras", editarComprasController.editarRequisicionCompras);
router.post("/:id/regenerar-pdf", editarComprasController.regenerarPdfRequisicion);

/* -------------------------- Visto Bueno (acciones) ---------------------------- */
router.post("/:id/aprobar-y-notificar", vbController.aprobarYNotificar);
router.post("/:id/rechazar", vbController.rechazarRequisicion);

/* ------------------------ Detalle (dejar hasta el final) ---------------------- */
router.get("/:id", genController.getRequisicionDetalle);

module.exports = router;
