// C:/SIRA/backend/routes/dashboard.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const dashboardController = require("../controllers/dashboard.controller");

router.use(verifyFirebaseToken, loadSiraUser);

// Ruta para el dashboard de compras
router.get("/compras", dashboardController.getComprasDashboard);

module.exports = router;