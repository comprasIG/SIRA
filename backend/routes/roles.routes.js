// backend/routes/roles.routes.js
const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rolesController = require("../controllers/roles.controller");

// --- Seguridad: Todas las rutas de roles requieren autenticación ---
router.use(verifyFirebaseToken, loadSiraUser);

// GET /api/roles (Obtiene todos los roles + usuarios + funciones)
router.get("/", rolesController.getRolesConDetalle);

// GET /api/roles/funciones (Obtiene la lista maestra de funciones)
router.get("/funciones", rolesController.getAllFunciones);

// POST /api/roles (Crea un nuevo rol)
router.post("/", rolesController.crearRol);

// POST /api/roles/:rolId/sync-funciones (Actualiza los permisos de un rol)
router.post("/:rolId/sync-funciones", rolesController.syncFuncionesRol);

// PUT /api/roles/cambiar-usuario/:usuarioId (Mueve un usuario a un nuevo rol)
// (Lo ponemos en /api/roles en lugar de /api/usuarios para mantener la lógica agrupada)
router.put("/cambiar-usuario/:usuarioId", rolesController.cambiarRolUsuario);

module.exports = router;