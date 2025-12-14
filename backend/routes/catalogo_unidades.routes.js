// 1. Importamos el Router de Express
const { Router } = require('express');

// 2. Importamos la función específica del controlador
const { getUnidades } = require('../controllers/catalogo_unidades.controller.js');

// 3. Creamos una instancia del router
const router = Router();

// 4. Definimos la ruta
// Cuando se reciba un GET en '/catalogo_unidades', se llamará a la función 'getUnidades'
router.get('/catalogo_unidades', getUnidades);

// 5. Exportamos el router para que app.js (o index.js) pueda usarlo
module.exports = router;