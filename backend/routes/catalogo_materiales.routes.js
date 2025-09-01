//D:\SIRA\SIRA\backend\routes\catalogo_materiales.routes.js
const express = require('express');
const router = express.Router();
const {
  agregarProducto,
  obtenerProductos,
  eliminarProducto,
  actualizarProducto
} = require('../controllers/catalogo_materiales.controller');

router.post('/', agregarProducto);
router.get('/', obtenerProductos);
router.delete('/:id', eliminarProducto);
router.put('/:id', actualizarProducto);

module.exports = router;