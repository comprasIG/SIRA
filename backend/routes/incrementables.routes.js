// backend/routes/incrementables.routes.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const ctrl = require('../controllers/incrementables.controller');

router.use(verifyFirebaseToken, loadSiraUser);

router.get('/', ctrl.listarIncrementables);
router.get('/datos-iniciales', ctrl.getDatosIniciales);

// Catálogos (deben ir antes de /:id para no colisionar)
router.get('/catalogos/tipos', ctrl.listarTipos);
router.post('/catalogos/tipos', ctrl.crearTipo);
router.put('/catalogos/tipos/:id', ctrl.actualizarTipo);
router.get('/catalogos/incoterms', ctrl.listarIncoterms);
router.post('/catalogos/incoterms', ctrl.crearIncoterm);
router.put('/catalogos/incoterms/:id', ctrl.actualizarIncoterm);

router.get('/:id/preview-distribucion', ctrl.previewDistribucion);
router.post('/crear', ctrl.crearIncrementable);

module.exports = router;
