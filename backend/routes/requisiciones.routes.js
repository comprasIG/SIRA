// C:\SIRA\backend\routes\requisiciones.routes.js

// C:\SIRA\backend\routes\requisiciones.routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

const { 
  crearRequisicion, 
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  aprobarRequisicion,
  rechazarRequisicion,
  actualizarRequisicion // <-- Se importa la nueva función
} = require('../controllers/requisiciones.controller');

// Configuración de Multer para manejar la subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Límite de 50MB
});

// Se aplican los middlewares de autenticación a todas las rutas de este archivo
router.use(verifyFirebaseToken, loadSiraUser);

// --- RUTAS DEL MÓDULO DE REQUISICIONES ---

// POST /api/requisiciones/ -> Crear una nueva requisición (con hasta 5 archivos adjuntos)
router.post("/", upload.array('archivosAdjuntos', 5), crearRequisicion);

// GET /api/requisiciones/por-aprobar -> Obtiene las requisiciones pendientes para el Visto Bueno
router.get("/por-aprobar", getRequisicionesPorAprobar);

// GET /api/requisiciones/:id -> Obtiene el detalle de una requisición específica
router.get("/:id", getRequisicionDetalle);

// --- CORRECCIÓN: Se añade la nueva ruta PUT para actualizar una requisición ---
// PUT /api/requisiciones/:id -> Actualiza una requisición existente
router.put("/:id", actualizarRequisicion);

// POST /api/requisiciones/:id/aprobar -> Aprueba una requisición y genera el RFQ
router.post("/:id/aprobar", aprobarRequisicion);

// POST /api/requisiciones/:id/rechazar -> Rechaza (cancela) una requisición
router.post("/:id/rechazar", rechazarRequisicion);

module.exports = router;