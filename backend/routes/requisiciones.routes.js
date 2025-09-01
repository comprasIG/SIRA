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
  rechazarRequisicion
} = require('../controllers/requisiciones.controller');

// Configuración de Multer (sin cambios) [cite: 3]
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Aplicamos los middlewares a todas las rutas (sin cambios) [cite: 4]
router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas ---

// 👈 CAMBIO: Añadimos el middleware de Multer para que acepte hasta 5 archivos
router.post("/", upload.array('archivosAdjuntos', 5), crearRequisicion);

// GET /api/requisiciones/por-aprobar -> Obtiene requisiciones para el VB del depto. [cite: 6]
router.get("/por-aprobar", getRequisicionesPorAprobar);

// GET /api/requisiciones/:id -> Obtiene el detalle de una requisición [cite: 7]
router.get("/:id", getRequisicionDetalle);

// POST /api/requisiciones/:id/aprobar -> Aprueba y genera RFQ [cite: 7]
router.post("/:id/aprobar", aprobarRequisicion);

// POST /api/requisiciones/:id/rechazar -> Rechaza (cancela) una requisición [cite: 8]
router.post("/:id/rechazar", rechazarRequisicion);

module.exports = router;