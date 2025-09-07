// C:/SIRA/backend/routes/dashboard.routes.js

// backend/routes/dashboard.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const dashboardController = require("../controllers/dashboard.controller");

router.use(verifyFirebaseToken, loadSiraUser);

// Dashboard principal
router.get("/compras", dashboardController.getComprasDashboard);

// Lista de departamentos para el filtro
router.get("/departamentos", dashboardController.getDepartamentosConRfq);

// NUEVO: Endpoints para enums dinámicos
router.get("/status-options", dashboardController.getStatusOptions);

module.exports = router;
