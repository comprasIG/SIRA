// C:\SIRA\backend\routes\proveedores.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const {
  getProveedores,
  listProveedores,
  createProveedor,
  updateProveedor,
} = require("../controllers/proveedores.controller");

// Proteger todas las rutas de proveedores
router.use(verifyFirebaseToken, loadSiraUser);

// GET /api/proveedores -> Búsqueda de proveedores por nombre
router.get("/", getProveedores);

// GET /api/proveedores/list -> Lista de proveedores con filtros
router.get("/list", listProveedores);

// POST /api/proveedores -> Crear proveedor
router.post("/", createProveedor);

// PUT /api/proveedores/:id -> Actualizar proveedor
router.put("/:id", updateProveedor);

module.exports = router;
