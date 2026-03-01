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
const { getProyectosDashboard, updateProyectoStatus, getProyectoDetalle, getHitosProyecto, agregarHitoProyecto } = require("../controllers/dashboard/proyectosDashboard.controller");
// Controlador de hitos (KPI TO DO)
const { getHitosDashboard, marcarHitoRealizado, marcarHitoPendiente, getComentariosHito, addComentarioHito, responderComentario, cambiarStatusComentario } = require("../controllers/dashboard/hitosDashboard.controller");

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
router.get("/proyectos/:id/detalle", getProyectoDetalle);
router.get("/proyectos/:id/hitos", getHitosProyecto);
router.post("/proyectos/:id/hitos", agregarHitoProyecto);
router.patch("/proyectos/:id/status", updateProyectoStatus);

// KPI TO DO: Hitos con responsable asignado
router.get("/hitos", getHitosDashboard);
router.patch("/hitos/:id/realizado", marcarHitoRealizado);
router.patch("/hitos/:id/pendiente", marcarHitoPendiente);

// Comentarios de hitos (threads)
// IMPORTANTE: la ruta de comentarios/:id debe ir ANTES de la ruta /:id/comentarios
// para que Express no confunda "comentarios" como un :id
router.post("/hitos/comentarios/:comentarioId/responder", responderComentario);
router.patch("/hitos/comentarios/:comentarioId/status", cambiarStatusComentario);
router.get("/hitos/:id/comentarios", getComentariosHito);
router.post("/hitos/:id/comentarios", addComentarioHito);

// Analytics para modal TV (solo SSD)
router.get("/analytics", dashboardController.getAnalyticsDashboard);
router.get("/notificaciones", dashboardController.getNotificaciones);

module.exports = router;