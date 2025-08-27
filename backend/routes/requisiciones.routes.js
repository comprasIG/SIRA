// C:\SIRA\backend\routes\requisiciones.routes.js
/*const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { crearRequisicion } = require('../controllers/requisiciones.controller');

// Ruta protegida única
router.post("/", verifyFirebaseToken, crearRequisicion);

module.exports = router;
*/

// C:\SIRA\backend\routes\requisiciones.routes.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser"); // <--- Importamos el nuevo middleware

const { 
  crearRequisicion, 
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  aprobarRequisicion,
  rechazarRequisicion
} = require('../controllers/requisiciones.controller');

// Aplicamos los middlewares a todas las rutas de este archivo
router.use(verifyFirebaseToken, loadSiraUser);

// --- Rutas ---

// POST /api/requisiciones/ -> Crear una nueva requisición
router.post("/", crearRequisicion);

// GET /api/requisiciones/por-aprobar -> Obtiene requisiciones para el VB del depto.
router.get("/por-aprobar", getRequisicionesPorAprobar);

// GET /api/requisiciones/:id -> Obtiene el detalle de una requisición
router.get("/:id", getRequisicionDetalle);

// POST /api/requisiciones/:id/aprobar -> Aprueba y genera RFQ
router.post("/:id/aprobar", aprobarRequisicion);

// POST /api/requisiciones/:id/rechazar -> Rechaza (cancela) una requisición
router.post("/:id/rechazar", rechazarRequisicion);

module.exports = router;