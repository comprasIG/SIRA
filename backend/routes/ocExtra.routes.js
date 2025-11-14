// C:\SIRA\backend\routes\ocExtra.routes.js

const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const loadSiraUser = require('../middleware/loadSiraUser');

const {
  getCatalogosExtraOc,
  crearOcExtraordinaria,
  obtenerOcExtraordinaria,
  listarOcExtraordinarias,
} = require('../controllers/ocExtraordinaria/generacion.controller');

const {
  enviarOcExtraARevision,
  aprobarOcExtra,
  rechazarOcExtra,
  descargarPdfOcExtra,
} = require('../controllers/ocExtraordinaria/vistoBueno.controller');

router.use(verifyFirebaseToken, loadSiraUser);

router.get('/catalogos', getCatalogosExtraOc);
router.get('/', listarOcExtraordinarias);
router.post('/', crearOcExtraordinaria);
router.get('/:id', obtenerOcExtraordinaria);
router.post('/:id/enviar', enviarOcExtraARevision);
router.post('/:id/aprobar', aprobarOcExtra);
router.post('/:id/rechazar', rechazarOcExtra);
router.get('/:id/pdf', descargarPdfOcExtra);

module.exports = router;
