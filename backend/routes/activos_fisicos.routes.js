// backend/routes/activos_fisicos.routes.js

const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const ctrl = require('../controllers/activos_fisicos.controller');

router.use(verifyFirebaseToken, loadSiraUser);

// ── Catálogos ──────────────────────────────────────────────────────────────────
router.get('/categorias',      ctrl.listCategorias);
router.post('/categorias',     ctrl.createCategoria);
router.put('/categorias/:id',  ctrl.updateCategoria);

router.get('/tipos',           ctrl.listTipos);
router.post('/tipos',          ctrl.createTipo);
router.put('/tipos/:id',       ctrl.updateTipo);

router.get('/ubicaciones',     ctrl.listUbicaciones);
router.post('/ubicaciones',    ctrl.createUbicacion);
router.put('/ubicaciones/:id', ctrl.updateUbicacion);

// ── Pendientes de asignación ──────────────────────────────────────────────────
router.get('/pendientes/count', ctrl.getPendientesCount);
router.get('/pendientes',       ctrl.listPendientes);

// ── Movimientos globales ───────────────────────────────────────────────────────
router.get('/movimientos', ctrl.listMovimientos);

// ── Activos (bulk antes que /:id para no colisionar) ──────────────────────────
router.post('/bulk', ctrl.bulkCreateActivos);

router.get('/',    ctrl.listActivos);
router.post('/',   ctrl.createActivo);
router.put('/:id', ctrl.updateActivo);

router.get('/:id/movimientos',  ctrl.listMovimientosActivo);
router.post('/:id/movimientos', ctrl.createMovimiento);

module.exports = router;
