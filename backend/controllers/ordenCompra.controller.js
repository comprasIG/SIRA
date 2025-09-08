//C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (OC)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Maneja las peticiones HTTP para la gestión de Órdenes de Compra.
 */

// --- Importaciones de Servicios---
const ocCreationService = require('../services/ocCreationService');
// --- ¡NUEVO! Importamos el servicio de autorización ---
const ocAuthorizationService = require('../services/ocAuthorizationService');

// ===============================================================================================
// --- Funciones del Controlador ---
// ===============================================================================================

/**
 * @route   POST /api/ocs/rfq/:rfqId/generar-oc
 * @desc    Genera (pre-autoriza) una nueva OC desde un RFQ.
 * @access  Privado
 */
const generarOrdenDeCompra = async (req, res) => {
  try {
    const { rfqId } = req.params;
    const { opcionIds, proveedor_id } = req.body;
    const { id: usuarioId } = req.usuarioSira;

    if (!opcionIds || !Array.isArray(opcionIds) || opcionIds.length === 0) {
      return res.status(400).json({ error: "Se requiere un arreglo con los IDs de las opciones seleccionadas." });
    }
    // ... (otras validaciones)

    const nuevaOc = await ocCreationService.crearOrdenDeCompraDesdeRfq({
      rfqId,
      usuarioId,
      opcionIds
    });

    res.status(201).json({
      mensaje: `Orden de Compra ${nuevaOc.numero_oc} generada exitosamente. Lista para autorización final.`,
      ordenDeCompra: nuevaOc,
    });
  } catch (error) {
    console.error("Error en el controlador al generar la Orden de Compra:", error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al generar la OC.' });
  }
};

/**
 * ===============================================================================================
 * --- ¡NUEVA FUNCIÓN! ---
 * ===============================================================================================
 * @route   POST /api/ocs/:id/autorizar
 * @desc    Inicia el proceso completo de autorización para una OC (PDF, Drive, Email, etc.).
 * @access  Privado
 */
const autorizarOrdenDeCompra = async (req, res) => {
  try {
    // 1. Extraer datos de la solicitud.
    const { id: ocId } = req.params; // El ID de la OC a autorizar viene en la URL.
    const usuarioSira = req.usuarioSira; // El usuario que autoriza viene del middleware.

    // 2. Validación simple.
    if (!ocId) {
      return res.status(400).json({ error: 'Se requiere el ID de la Orden de Compra.' });
    }

    // 3. Llamada al servicio orquestador.
    console.log(`Controlador: Recibida solicitud para autorizar OC ID: ${ocId} por ${usuarioSira.nombre}`);
    const resultado = await ocAuthorizationService.authorizeAndDistributeOC(ocId, usuarioSira);

    // 4. Respuesta al cliente.
    res.status(200).json(resultado);

  } catch (error) {
    // 5. Manejo de errores.
    console.error(`Controlador: Error al autorizar la OC ID ${req.params.id}:`, error);
    // Si el servicio lanza un error (ej. "OC ya procesada"), se envía al cliente.
    res.status(500).json({ error: error.message || 'Error interno del servidor al autorizar la OC.' });
  }
};

// --- Exportaciones del Módulo ---
module.exports = {
  generarOrdenDeCompra,
  autorizarOrdenDeCompra, // <-- Se exporta la nueva función
};