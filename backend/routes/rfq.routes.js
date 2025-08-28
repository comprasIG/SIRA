// C:\SIRA\backend\routes\rfq.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const rfqController = require("../controllers/rfq.controller");

// Middleware para todas las rutas de este archivo
router.use(verifyFirebaseToken, loadSiraUser);

// GET /api/rfq/pendientes -> Obtiene requisiciones con estatus 'COTIZANDO'
router.get("/pendientes", rfqController.getRequisicionesCotizando);

// GET /api/rfq/:id -> Obtiene el detalle completo para la cotización
router.get("/:id", rfqController.getRfqDetalle);

// POST /api/rfq/:id/opciones -> Guarda o actualiza las opciones de cotización para una requisición
router.post("/:id/opciones", rfqController.guardarOpcionesRfq);

// POST /api/rfq/:id/enviar-a-aprobacion -> Cambia el estatus de la requisición a 'POR_APROBAR'
router.post("/:id/enviar-a-aprobacion", rfqController.enviarRfqAprobacion);


module.exports = router;