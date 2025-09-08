/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (OC)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Este controlador maneja las peticiones HTTP relacionadas con la gestión de
 * Órdenes de Compra. Se comunica con los servicios correspondientes para ejecutar la
 * lógica de negocio y responde al cliente.
 */

// --- Importaciones ---
// Importamos el servicio que contiene la lógica para crear OCs.
const ocCreationService = require('../services/ocCreationService');

// ===============================================================================================
// --- Funciones del Controlador ---
// ===============================================================================================

/**
 * Maneja la solicitud para generar (pre-autorizar) una nueva Orden de Compra desde un RFQ.
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
const generarOrdenDeCompra = async (req, res) => {
  try {
    // 1. Extraer datos de la solicitud.
    // El ID del RFQ viene de los parámetros de la URL (ej. /api/rfq/42/generar-oc).
    const { rfqId } = req.params;
    // El arreglo con los IDs de las opciones seleccionadas viene en el cuerpo de la petición.
    const { opcionIds, proveedor_id } = req.body;
    // El ID del usuario que realiza la acción se obtiene del middleware de autenticación.
    const { id: usuarioId } = req.usuarioSira;

    // 2. Validación de la entrada.
    // Verificamos que los datos necesarios estén presentes.
    if (!opcionIds || !Array.isArray(opcionIds) || opcionIds.length === 0) {
      return res.status(400).json({ error: "Se requiere un arreglo con los IDs de las opciones seleccionadas." });
    }
    if (!proveedor_id) {
        return res.status(400).json({ error: "El ID del proveedor es requerido." });
    }
    if (!rfqId || !usuarioId) {
        return res.status(400).json({ error: "Faltan parámetros esenciales (RFQ ID o Usuario ID)." });
    }

    // 3. Llamada al servicio de negocio.
    // Pasamos los datos validados a nuestro servicio para que ejecute la lógica compleja.
    const nuevaOc = await ocCreationService.crearOrdenDeCompraDesdeRfq({
      rfqId,
      usuarioId,
      opcionIds
    });

    // 4. Respuesta al cliente.
    // Si todo sale bien, respondemos con un estado 201 (Creado) y la información de la nueva OC.
    res.status(201).json({
      mensaje: `Orden de Compra ${nuevaOc.numero_oc} generada exitosamente y enviada para autorización de Finanzas.`,
      ordenDeCompra: nuevaOc,
    });

  } catch (error) {
    // 5. Manejo de errores.
    // Si algo falla (en el controlador o en el servicio), se captura el error aquí.
    console.error("Error en el controlador al generar la Orden de Compra:", error);
    // Respondemos con un error 500 (Error Interno del Servidor).
    res.status(500).json({ error: error.message || 'Error interno del servidor al procesar la solicitud.' });
  }
};

/**
 * NOTA: Futuras funciones del controlador irían aquí.
 * - aprobarOcFinanzas(req, res)
 * - rechazarOcFinanzas(req, res)
 * - getOrdenDeCompraDetalle(req, res)
 */

// --- Exportaciones del Módulo ---
module.exports = {
  generarOrdenDeCompra,
};