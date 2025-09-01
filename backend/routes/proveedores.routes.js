// C:\SIRA\backend\routes\proveedores.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const { getProveedores } = require("../controllers/proveedores.controller");

// Proteger todas las rutas de proveedores
router.use(verifyFirebaseToken, loadSiraUser);

// GET /api/proveedores -> Búsqueda de proveedores por nombre
router.get("/", getProveedores);

module.exports = router;