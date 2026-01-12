// backend/routes/inventario.routes.js
/**
 * ROUTES: INVENTARIO
 * =========================================================================================
 * Montaje esperado en app.js:
 *   app.use('/api/inventario', inventarioRoutes);
 *
 * Seguridad:
 * - Todas las rutas están protegidas con:
 *   verifyFirebaseToken + loadSiraUser
 *
 * Endpoints:
 * - GET    /datos-iniciales
 * - GET    /
 * - GET    /catalogo-resumen
 * - GET    /material/:materialId/asignaciones
 * - GET    /kardex
 * - POST   /ajustes
 * - POST   /apartar
 * - POST   /mover-asignacion
 * - POST   /movimientos/:id/reversar
 */

const express = require("express");
const router = express.Router();

const inventarioController = require("../controllers/inventario.controller");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// -----------------------------------------------------------------------------------------
// Middlewares globales (auth)
// -----------------------------------------------------------------------------------------
router.use(verifyFirebaseToken, loadSiraUser);

// -----------------------------------------------------------------------------------------
// Datos iniciales (KPIs + filtros + ubicaciones)
// -----------------------------------------------------------------------------------------
// GET /api/inventario/datos-iniciales
router.get("/datos-iniciales", inventarioController.getDatosIniciales);

// -----------------------------------------------------------------------------------------
// Listados principales
// -----------------------------------------------------------------------------------------
// GET /api/inventario
// Lista agregada por material (existentes) con filtros via query params
router.get("/", inventarioController.getInventarioActual);

// GET /api/inventario/catalogo-resumen
// Devuelve TODO el catálogo de materiales ACTIVOS aunque no existan en inventario_actual (para ajustes/alta inicial)
router.get("/catalogo-resumen", inventarioController.getCatalogoResumen);

// -----------------------------------------------------------------------------------------
// Detalles por material
// -----------------------------------------------------------------------------------------
// GET /api/inventario/material/:materialId/asignaciones
router.get("/material/:materialId/asignaciones", inventarioController.getDetalleAsignacionesMaterial);

// -----------------------------------------------------------------------------------------
// Kardex / auditoría
// -----------------------------------------------------------------------------------------
// GET /api/inventario/kardex
router.get("/kardex", inventarioController.getKardex);

// -----------------------------------------------------------------------------------------
// Acciones / Mutaciones de inventario
// -----------------------------------------------------------------------------------------
// POST /api/inventario/ajustes
// Ajuste manual (solo superusuario). Permite alta inicial si no existe inventario_actual.
router.post("/ajustes", inventarioController.ajustarInventario);

// POST /api/inventario/apartar
// Apartar desde disponible (stock_actual) hacia asignado (inventario_asignado + inventario_actual.asignado)
// Kardex: tipo_movimiento = 'APARTADO'
router.post("/apartar", inventarioController.apartarStock);

// POST /api/inventario/mover-asignacion
// Mover asignaciones entre proyectos/sitios (Kardex: TRASPASO)
router.post("/mover-asignacion", inventarioController.moverAsignacion);

// POST /api/inventario/movimientos/:id/reversar
// Reversa/anulación (solo superusuario, mismo día, bloquea negativos)
router.post("/movimientos/:id/reversar", inventarioController.reversarMovimiento);

module.exports = router;
