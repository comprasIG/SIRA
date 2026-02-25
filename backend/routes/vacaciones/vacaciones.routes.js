const express = require('express');
const router = express.Router();
const vacacionesController = require('../../controllers/Vacaciones/vacaciones.Controller');

// 1. Ruta para consultar el saldo de vacaciones de un empleado
// Ejemplo de uso: GET /api/vacaciones/saldo/5
router.get('/saldo/:empleado_id', vacacionesController.consultarSaldoVacaciones);

// 2. Ruta para crear una nueva solicitud de vacaciones
// Ejemplo de uso: POST /api/vacaciones/solicitar
router.post('/solicitar', vacacionesController.solicitarVacaciones);

// 3. Ruta para obtener el historial de vacaciones (opcional, pero útil para el dashboard)
// Ejemplo de uso: GET /api/vacaciones/historial
router.get('/historial', vacacionesController.obtenerHistorialVacaciones);

// 4. Ruta para actualizar el estatus (Aprobar o Rechazar)
router.put('/:id/estatus', vacacionesController.actualizarEstatus);

// 5. Ruta para descargar el PDF de una solicitud de vacaciones
router.get('/:id/pdf', vacacionesController.descargarPdfVacaciones);

module.exports = router;