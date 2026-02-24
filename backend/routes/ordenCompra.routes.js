// C:\SIRA\backend\routes\ordenCompra.routes.js
/**
 * =================================================================================================
 * RUTAS: Órdenes de Compra (solo descarga de PDF)
 * Opción A — Limpieza total: sin endpoint legacy de creación/autorizar
 * =================================================================================================
 */

const express = require("express");
const router = express.Router();
const { descargarOcPdf, getOcs, getOcFilters, getDatosParaEditar, editarOc } = require("../controllers/ordenCompra.controller");

// Mantengo tus middlewares y sus rutas actuales:
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

router.use(verifyFirebaseToken, loadSiraUser);

// Listar OCs (rutas fijas primero, antes de las parametrizadas)
router.get("/", getOcs);
router.get("/filters", getOcFilters);

// Edición de OC
router.get("/:id/editar-datos", getDatosParaEditar);
router.patch("/:id/editar", editarOc);

// Descargar PDF de una OC
router.get("/:id/pdf", descargarOcPdf);

module.exports = router;
