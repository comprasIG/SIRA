const express = require('express');
const router = express.Router();
const empleadosController = require('../../controllers/empleados/empleadosController'); // Ajusta la ruta a tu controlador si es diferente
const multer = require('multer');

// --- Configuración básica de Multer ---
// Usamos memoria temporal (MemoryStorage) por ahora. 
// Multer extraerá los textos hacia req.body y la foto hacia req.file
const upload = multer({ storage: multer.memoryStorage() });

// --- Rutas ---
// Nota cómo agregamos `upload.single('foto_emp')` en medio de la ruta y el controlador
router.get('/', empleadosController.obtenerEmpleados);

// Ruta POST: Usar multer para interceptar el 'FormData'
router.post('/', upload.single('foto_emp'), empleadosController.crearEmpleado);

// Ruta PUT: Usar multer para interceptar el 'FormData' al actualizar
router.put('/:id', upload.single('foto_emp'), empleadosController.actualizarEmpleado);

router.delete('/:id', empleadosController.eliminarEmpleado);

module.exports = router;