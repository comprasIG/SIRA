// C:\SIRA\backend\routes\requisiciones.routes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// Se importan TODAS las funciones del controlador, incluyendo la nueva
const { 
  crearRequisicion, 
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  aprobarRequisicion,
  rechazarRequisicion,
  actualizarRequisicion,
  aprobarYNotificar // <-- Se importa la nueva función
} = require('../controllers/requisiciones.controller');

// Configuración de Multer para manejar la subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Límite de 50MB
});

// Se aplican los middlewares de autenticación a TODAS las rutas de este archivo
// Esto asegura que la nueva ruta también esté protegida
router.use(verifyFirebaseToken, loadSiraUser);

// --- RUTAS DEL MÓDULO DE REQUISICIONES ---

// POST /api/requisiciones/ -> Crear una nueva requisición
router.post("/", upload.array('archivosAdjuntos', 5), crearRequisicion);

// GET /api/requisiciones/por-aprobar -> Obtiene las requisiciones pendientes para el Visto Bueno
router.get("/por-aprobar", getRequisicionesPorAprobar);

// GET /api/requisiciones/:id -> Obtiene el detalle de una requisición específica
router.get("/:id", getRequisicionDetalle);

// PUT /api/requisiciones/:id -> Actualiza una requisición existente
router.put("/:id", upload.array('archivosNuevos', 5), actualizarRequisicion);

// --- RUTA NUEVA ---
// POST /api/requisiciones/:id/aprobar-y-notificar -> Aprueba, genera PDF y notifica por correo
router.post("/:id/aprobar-y-notificar", aprobarYNotificar);


// --- RUTAS ANTIGUAS (Se pueden mantener o eliminar según tu necesidad) ---

// POST /api/requisiciones/:id/aprobar -> Aprueba una requisición (versión original sin correo)
router.post("/:id/aprobar", aprobarRequisicion);

// POST /api/requisiciones/:id/rechazar -> Rechaza (cancela) una requisición
router.post("/:id/rechazar", rechazarRequisicion);


module.exports = router;