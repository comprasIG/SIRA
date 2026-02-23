// backend/routes/roles.routes.js
const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const ctrl = require("../controllers/roles.controller");

router.use(verifyFirebaseToken, loadSiraUser);

// ── Roles y Permisos ─────────────────────────────────────────────────────────
router.get("/", ctrl.getRolesConDetalle);
router.get("/funciones", ctrl.getAllFunciones);
router.post("/", ctrl.crearRol);
router.post("/:rolId/sync-funciones", ctrl.syncFuncionesRol);
router.put("/cambiar-usuario/:usuarioId", ctrl.cambiarRolUsuario);

// ── Acceso Flotilla (qué departamentos ven todas las unidades) ────────────────
router.get("/acceso-unidades", ctrl.getDeptAccesoUnidades);
router.put("/acceso-unidades/:deptoId", ctrl.updateDeptAccesoUnidades);

// ── Config Tipos de Evento de Unidades ────────────────────────────────────────
router.get("/evento-tipos-config", ctrl.getEventoTiposConfig);
router.put("/evento-tipos-config/:id", ctrl.updateEventoTipoConfig);

module.exports = router;
