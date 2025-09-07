// C:\SIRA\backend\routes\requisiciones.routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// CAMBIO: Se limpia la lista de importaciones para quitar la función obsoleta
const { 
  crearRequisicion, 
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  actualizarRequisicion,
  rechazarRequisicion,
  aprobarYNotificar 
} = require('../controllers/requisiciones.controller');

// Configuración de Multer para manejar la subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Se aplican los middlewares de autenticación a TODAS las rutas de este archivo
router.use(verifyFirebaseToken, loadSiraUser);

// --- RUTAS DEL MÓDULO DE REQUISICIONES ---

// POST /api/requisiciones/ -> Crear una nueva requisición
router.post("/", upload.array('archivosAdjuntos', 5), crearRequisicion);

// GET /api/requisiciones/por-aprobar -> Obtiene las requisiciones pendientes
router.get("/por-aprobar", getRequisicionesPorAprobar);

// GET /api/requisiciones/:id -> Obtiene el detalle de una requisición
router.get("/:id", getRequisicionDetalle);

// PUT /api/requisiciones/:id -> Actualiza una requisición
router.put("/:id", upload.array('archivosNuevos', 5), actualizarRequisicion);

// POST /api/requisiciones/:id/aprobar-y-notificar -> Aprueba, genera PDF y notifica
router.post("/:id/aprobar-y-notificar", aprobarYNotificar);

// POST /api/requisiciones/:id/rechazar -> Rechaza (cancela) una requisición
router.post("/:id/rechazar", rechazarRequisicion);

// ELIMINADO: Se quita la ruta antigua '/aprobar' que llamaba a la función obsoleta.

module.exports = router;