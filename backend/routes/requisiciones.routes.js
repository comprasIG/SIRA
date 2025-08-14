const express = require('express');
const router = express.Router();
const requisicionesController = require('../controllers/requisiciones.controller');

// Endpoint para crear una requisición (POST)
router.post('/', requisicionesController.crearRequisicion);

// Aquí puedes agregar más endpoints relacionados a requisiciones (listar, aprobar, etc.)
// Ejemplo: router.get('/', requisicionesController.listarRequisiciones);

module.exports = router;
