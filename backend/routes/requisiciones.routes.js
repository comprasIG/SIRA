// C:\SIRA\backend\routes\requisiciones.routes.js
/**
 * =================================================================================================
 * RUTAS: Requisiciones
 * - El router se monta desde app.js en: /api/requisiciones
 * - ¡Importante! Las rutas internas aquí son RELATIVAS (sin /api/... al inicio).
 * - Este archivo asume el árbol:
 *    backend/
 *      middleware/verifyFirebaseToken.js
 *      middleware/loadSiraUser.js
 *      controllers/requisiciones/...
 *      routes/requisiciones.routes.js  <-- estás aquí
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");

// 🔧 CORRECCIÓN DE RUTA: estamos en /routes → subir un nivel a /middleware
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// Controladores
const {
  getMiBorrador,
  upsertMiBorrador,
  borrarMiBorrador,
} = require("../controllers/requisiciones/borradores.controller");

const genController = require("../controllers/requisiciones/generacion.controller");
const vbController = require("../controllers/requisiciones/vistoBueno.controller");

// Subida de archivos en memoria (ajusta límites si lo requieres)
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares de auth/carga de usuario para TODO el router
router.use(verifyFirebaseToken, loadSiraUser);

/* -------------------------- Rutas específicas primero -------------------------- */
// Visto bueno: lista por aprobar (ejemplo)
router.get("/por-aprobar", vbController.getRequisicionesPorAprobar);

/* --------------------------------- Borradores --------------------------------- */
router.get("/borrador/mio", getMiBorrador);
router.post("/borrador", upsertMiBorrador);
router.delete("/borrador", borrarMiBorrador);

/* ------------------------ Generación y edición (CRUD) ------------------------- */
router.post("/", upload.array("archivosAdjuntos", 5), genController.crearRequisicion);
router.put("/:id", upload.array("archivosNuevos", 5), genController.actualizarRequisicion);

/* -------------------------- Visto Bueno (acciones) ---------------------------- */
router.post("/:id/aprobar-y-notificar", vbController.aprobarYNotificar);
router.post("/:id/rechazar", vbController.rechazarRequisicion);

/* ------------------------ Detalle (dejar hasta el final) ---------------------- */
router.get("/:id", genController.getDetalleRequisicion);

module.exports = router;
