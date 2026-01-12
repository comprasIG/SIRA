// backend/controllers/inventario.controller.js
/**
 * INVENTARIO CONTROLLER (FACHADA)
 * =============================================================================
 * Este archivo existe para NO romper imports existentes en rutas:
 *   const inventarioController = require('../controllers/inventario.controller');
 *
 * Toda la lógica real vive en /controllers/inventario/*
 * 
 * backend/
  controllers/
    inventario.controller.js              (fachada, re-export)
    inventario/
      index.js
      helpers.js
      parametros.js
      inventarioActual.service.js
      inventarioAsignado.service.js
      datosIniciales.controller.js
      listados.controller.js
      kardex.controller.js
      ajustes.controller.js
      asignaciones.controller.js
      reversa.controller.js

 */

module.exports = require("./inventario");
