// C:/SIRA/backend/routes/dashboard.routes.js

// backend/routes/dashboard.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");
const dashboardController = require("../controllers/dashboard.controller");
// Importar el controlador específico para obtener detalles de OC
const ordenCompraDashboardController = require("../controllers/dashboard/ordenCompraDashboard.controller");
// Controlador de proyectos para el tab de Proyectos en dashboards
const { getProyectosDashboard, updateProyectoStatus } = require("../controllers/dashboard/proyectosDashboard.controller");

router.use(verifyFirebaseToken, loadSiraUser);

// Dashboard principal
router.get("/compras", dashboardController.getComprasDashboard);

// Lista de departamentos para el filtro
router.get("/departamentos", dashboardController.getDepartamentosConRfq);

// NUEVO: Endpoints para enums dinámicos
router.get("/status-options", dashboardController.getStatusOptions);

// NUEVO: EndPoint para obtener detalle de una Orden de Compra por su número
router.get("/oc/:numero_oc", ordenCompraDashboardController.getOrdenCompraDetalle);

// Cambio manual de status de requisición (solo SSD)
router.patch("/requisicion/:id/status", dashboardController.updateRequisicionStatus);

// Tab de Proyectos en dashboards departamentales
router.get("/proyectos", getProyectosDashboard);
router.patch("/proyectos/:id/status", updateProyectoStatus);

module.exports = router;