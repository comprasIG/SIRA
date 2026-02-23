const express = require('express');
const router = require('express').Router();

// Importar el controlador de empleados
const empleadoController = require('../../controllers/empleados/empleadosController');

if (!empleadoController) {
    console.error("Error: No se pudo cargar el controlador de empleados. Revisa la ruta.");
}

// NUEVA RUTA: Obtener lista de departamentos
// ¡OJO! Como este archivo maneja todo lo de "empleados", la URL final será /api/empleados/departamentos
router.get('/departamentos', empleadoController.obtenerDepartamentos);

// Rutas del CRUD de empleados
router.get('/', empleadoController.obtenerEmpleados); 
router.post('/', empleadoController.crearEmpleado); 
router.put('/:id', empleadoController.actualizarEmpleado); 
router.delete('/:id', empleadoController.eliminarEmpleado); 

module.exports = router;