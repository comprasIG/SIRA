// backend/routes/rec_oc.routes.js

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const recOcController = require('../controllers/rec_oc.controller');

router.use(verifyFirebaseToken, loadSiraUser);

// Listar OCs "APROBADA" y "EN_PROCESO"
router.get('/pendientes', recOcController.listarPendientes);
router.get('/en-proceso', recOcController.listarEnProceso);

// Catálogos
router.get('/catalogos', recOcController.getCatalogos);

// Guardar método de recolección
router.post('/:ocId/metodo', recOcController.definirMetodo);

// Subir archivo de recolección
router.post('/:ocId/archivos', recOcController.subirArchivo);

// Notificar proveedor/recolecciones
router.post('/:ocId/notificar', recOcController.enviarNotificacion);

// Consultar historial OC
router.get('/:ocId/historial', recOcController.historialOc);

// Cancelar OC
router.post('/cancelar', recOcController.cancelarOc);

module.exports = router;
