// C:\SIRA\backend\routes\oc-directa.routes.js
/**
 * =================================================================================================
 * RUTAS: OC Directa (VB_OC)
 * - Datos iniciales (sitios, proyectos)
 * - Crear OC directa
 * =================================================================================================
 */

const express = require("express");
const router = express.Router();

const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const controller = require("../controllers/oc-directa.controller");

// Middleware global (auth + usuario SIRA)
router.use(verifyFirebaseToken, loadSiraUser);

// ================================================================================================
// Endpoints
// ================================================================================================
router.get("/datos-iniciales", controller.getDatosIniciales);
router.post("/crear", controller.crearOcDirecta);

module.exports = router;
