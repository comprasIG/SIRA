const express = require('express');
const router = require('express').Router();

// Importar el controlador de empleados
const empleadoController = require('../../controllers/empleados/empleadosController');

// Verifica que 'empleadoController' no sea undefined
if (!empleadoController) {
    console.error("Error: No se pudo cargar el controlador de empleados. Revisa la ruta.");
}

// Definir la ruta GET
router.get('/', empleadoController.obtenerEmpleados); // Asegúrate que la función se llame así 
// Asegúrate de que la función 'obtenerEmpleados' exista en tu controlador

module.exports = router;