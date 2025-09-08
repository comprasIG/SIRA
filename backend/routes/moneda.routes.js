/**C:\SIRA\backend\routes\moneda.routes.js
 * =================================================================================================
 * RUTAS: Monedas
 * =================================================================================================
 * @file moneda.routes.js
 * @description Define los endpoints de la API para las operaciones con el catálogo de monedas.
 */

// --- Importaciones ---
const express = require("express");
const router = express.Router();
const monedaController = require("../controllers/moneda.controller");

// --- Middlewares ---
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// Se aplican los middlewares de autenticación a todas las rutas de este archivo.
router.use(verifyFirebaseToken, loadSiraUser);

// --- Definición de Ruta ---
router.get("/", monedaController.getAllMonedas);

// --- Exportación ---
module.exports = router;