// 1. Importamos el Router de Express
const { Router } = require('express');

// 2. Importamos las funciones del controlador
const { getUnidades, createUnidad, updateUnidad } = require('../controllers/catalogo_unidades.controller.js');

// 3. Creamos una instancia del router
const router = Router();

// 4. Definimos las rutas
router.get('/catalogo_unidades', getUnidades);
router.post('/catalogo_unidades', createUnidad);
router.put('/catalogo_unidades/:id', updateUnidad);

// 5. Exportamos el router para que app.js (o index.js) pueda usarlo
module.exports = router;