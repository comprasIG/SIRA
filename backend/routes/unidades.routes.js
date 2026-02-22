// backend/routes/unidades.routes.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const ctrl = require('../controllers/unidades.controller');

// Autenticación en todas las rutas
router.use(verifyFirebaseToken, loadSiraUser);

// ── Dashboard principal ──────────────────────────────────────────────────────
// GET /api/unidades
router.get('/', ctrl.getUnidades);

// GET /api/unidades/datos-filtros
router.get('/datos-filtros', ctrl.getDatosParaFiltros);

// ── Tipos de evento (catálogo) ───────────────────────────────────────────────
// GET /api/unidades/evento-tipos  → lista completa con flags (reemplaza datos-modal-servicio)
router.get('/evento-tipos', ctrl.getEventoTipos);

// POST /api/unidades/evento-tipos → crea un tipo de evento personalizado
router.post('/evento-tipos', ctrl.crearEventoTipo);

// PUT /api/unidades/evento-tipos/:id → edita un tipo de evento
router.put('/evento-tipos/:id', ctrl.editarEventoTipo);

// DELETE /api/unidades/evento-tipos/:id → desactiva un tipo de evento (soft-delete)
router.delete('/evento-tipos/:id', ctrl.eliminarEventoTipo);

// ── Alertas de incidencia ────────────────────────────────────────────────────
// GET  /api/unidades/alertas
router.get('/alertas', ctrl.getAlertasAbiertas);

// PATCH /api/unidades/alertas/:historialId/cerrar
router.patch('/alertas/:historialId/cerrar', ctrl.cerrarAlerta);

// ── Registro de eventos ──────────────────────────────────────────────────────
// POST /api/unidades/requisicion   → crea requisición vehicular
router.post('/requisicion', ctrl.crearRequisicionVehicular);

// POST /api/unidades/historial/manual → registro manual (sin requisición)
router.post('/historial/manual', ctrl.agregarRegistroManualHistorial);

// ── Detalle e historial por unidad ───────────────────────────────────────────
// GET /api/unidades/:id/detalle
router.get('/:id/detalle', ctrl.getUnidadDetalle);

// GET /api/unidades/:id/historial   → soporta ?eventoTipoId=
router.get('/:id/historial', ctrl.getHistorialUnidad);

module.exports = router;
