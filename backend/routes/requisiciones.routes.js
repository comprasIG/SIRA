// C:\SIRA\backend\routes\requisiciones.routes.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { crearRequisicion } = require('../controllers/requisiciones.controller');

// Ruta protegida única
router.post("/", verifyFirebaseToken, crearRequisicion);

module.exports = router;
