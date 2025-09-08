//C:\SIRA\backend\routes\ordenCompra.routes.js

/**
 * =================================================================================================
 * RUTAS: Órdenes de Compra (OC)
 * =================================================================================================
 * @file ordenCompra.routes.js
 * @description Define los endpoints de la API para todas las operaciones relacionadas con las
 * Órdenes de Compra. Cada ruta se asocia a una función específica del controlador.
 */

// --- Importaciones ---
const express = require("express");
const router = express.Router();

// --- Middlewares ---
// Se importan los middlewares para verificar la autenticación del usuario y cargar su perfil.
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const loadSiraUser = require("../middleware/loadSiraUser");

// --- Controlador ---
// Se importa el controlador que contiene la lógica para manejar las peticiones.
const ocController = require("../controllers/ordenCompra.controller");

// ===============================================================================================
// --- Aplicación de Middlewares ---
// ===============================================================================================

// Todas las rutas definidas en este archivo requerirán que el usuario esté autenticado.
// `router.use()` aplica estos middlewares a cada una de las rutas que se definan a continuación.
router.use(verifyFirebaseToken, loadSiraUser);


// ===============================================================================================
// --- Definición de Rutas ---
// ===============================================================================================

/**
 * @route   POST /api/ocs/rfq/:rfqId/generar-oc
 * @desc    Genera (pre-autoriza) una o más OCs para un RFQ específico a partir de las opciones
 * de cotización seleccionadas.
 * @access  Privado (Requiere autenticación)
 */
router.post(
    "/rfq/:rfqId/generar-oc", // La URL del endpoint.
    ocController.generarOrdenDeCompra // La función del controlador que se ejecutará.
);

/**
 * NOTA: Aquí se añadirían futuras rutas para OCs, como:
 * router.post("/:id/aprobar-finanzas", ocController.aprobarOcFinanzas);
 * router.get("/:id", ocController.getOrdenDeCompraDetalle);
 */


// --- Exportación del Módulo ---
module.exports = router;