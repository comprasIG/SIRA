// backend/routes/inventario.routes.js
const express = require("express");
const router = express.Router();

const inventarioController = require("../controllers/inventario.controller");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// Autenticación para todas las rutas del módulo
router.use(verifyFirebaseToken, loadSiraUser);

/**
 * GET: Datos iniciales (KPIs + filtros)
 */
router.get("/datos-iniciales", inventarioController.getDatosIniciales);

/**
 * ✅ Paso 9C: catálogo resumen (activos + ceros)
 * Importante: declararlo ANTES de rutas con params dinámicos.
 */
router.get("/catalogo-resumen", inventarioController.getCatalogoResumen);

/**
 * GET: Lista principal (solo existentes) por material
 */
router.get("/", inventarioController.getInventarioActual);

/**
 * GET: detalle de asignaciones por material
 */
router.get("/material/:materialId/asignaciones", inventarioController.getDetalleAsignacionesMaterial);

/**
 * GET: kardex
 */
router.get("/kardex", inventarioController.getKardex);

/**
 * POST: reversa de movimiento
 */
router.post("/movimientos/:id/reversar", inventarioController.reversarMovimiento);

/**
 * POST: ajustes (entradas/salidas manuales)
 */
router.post("/ajustes", inventarioController.ajustarInventario);

/**
 * POST: apartar stock a proyecto
 */
router.post("/apartar", inventarioController.apartarStock);

/**
 * POST: mover asignación
 */
router.post("/mover-asignacion", inventarioController.moverAsignacion);

module.exports = router;
