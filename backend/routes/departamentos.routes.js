// C:\SIRA\backend\routes\departamentos.routes.js
const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { getDepartamentos } = require("../controllers/departamentos.controller");

router.get("/", verifyFirebaseToken, getDepartamentos);

module.exports = router;