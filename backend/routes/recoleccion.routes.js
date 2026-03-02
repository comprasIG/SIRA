// backend/routes/recoleccion.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');
const recoleccionController = require('../controllers/recoleccion.controller');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { files: 5, fileSize: 10 * 1024 * 1024 } });

router.use(verifyFirebaseToken, loadSiraUser);

// --- NUEVAS RUTAS PARA KPIs Y LISTAS ---
router.get('/kpis', recoleccionController.getRecoleccionKpis);
router.get('/ocs-en-proceso', recoleccionController.getOcsEnProceso);

// Ruta principal para obtener la lista de OCs APROBADAS con filtros
router.get('/ocs-aprobadas', recoleccionController.getOcsAprobadas);

router.get('/datos-filtros', recoleccionController.getDatosParaFiltros);

router.get('/kpis', recoleccionController.getRecoleccionKpis);

// --- MODIFICADO: La cancelación ahora es una ruta propia ---
router.post('/ocs/cancelar', recoleccionController.cancelarOcAprobada);

// Ruta para procesar una OC específica
router.post(
  '/ocs/:id/procesar',
  upload.array('evidencias', 5),
  recoleccionController.procesarOcParaRecoleccion
);

// Ruta para cerrar una OC Vehicular
router.post(
  '/ocs/:id/cerrar-vehicular',
  recoleccionController.cerrarOcVehicular
);

// Ruta para cerrar una OC Incrementable (aplica costos al inventario)
router.post(
  '/ocs/:id/cerrar-incrementable',
  recoleccionController.cerrarIncrementable
);

module.exports = router;