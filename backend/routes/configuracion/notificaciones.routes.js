/**
 * =================================================================================================
 * RUTAS: Configuración de Notificaciones (Actualizado con CRUD completo)
 * =================================================================================================
 */
const express = require("express");
const router = express.Router();
const notificacionesController = require("../../controllers/configuracion/notificaciones.controller");
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const loadSiraUser = require("../../middleware/loadSiraUser");

router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas para Grupos (Ahora con POST, PUT, DELETE) ---
router.get("/", notificacionesController.getAllGrupos);
router.post("/", notificacionesController.crearGrupo);
router.get("/:id", notificacionesController.getGrupoDetalle);
router.put("/:id", notificacionesController.actualizarGrupo);
router.delete("/:id", notificacionesController.eliminarGrupo);

// --- Rutas para Miembros (sin cambios) ---
router.post("/:id/usuarios", notificacionesController.asignarUsuario);
router.delete("/:id/usuarios/:usuarioId", notificacionesController.removerUsuario);

module.exports = router;