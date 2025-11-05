//C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Versión 2.1 - Corrección Nombres)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Corregido el bug del nombre de descarga 'OC-OC-'.
 */

// --- Importaciones de Módulos y Servicios ---
const pool = require('../db/pool');
const ocCreationService = require('../services/ocCreationService');
const ocAuthorizationService = require('../services/ocAuthorizationService');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');


// ===============================================================================================
// --- Funciones del Controlador ---
// ===============================================================================================

/**
 * @route   POST /api/ocs/rfq/:rfqId/generar-oc
 * @desc    Crea el registro de una nueva OC en la base de datos.
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

    const nuevaOc = await ocCreationService.crearOrdenDeCompraDesdeRfq({
      rfqId,
      usuarioId,
      opcionIds
    });

    // =================================================================
    // --- ¡CORRECCIÓN BUG "OC-OC-" (Paso 3)! ---
    // Se añade el prefijo 'OC-' al número que viene de la BD (ej: 254)
    // =================================================================
    res.status(201).json({
      mensaje: `Orden de Compra OC-${nuevaOc.numero_oc} generada exitosamente.`, // Añadimos prefijo
      ordenDeCompra: { ...nuevaOc, numero_oc: `OC-${nuevaOc.numero_oc}` }, // Añadimos prefijo
    });
  } catch (error) {
    console.error("Error en el controlador al generar la Orden de Compra:", error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al generar la OC.' });
  }
};

/**
 * @route   POST /api/ocs/:id/autorizar
 * @desc    Ejecuta el proceso completo de autorización (PDF, Drive, Email).
 * @access  Privado
 */
const autorizarOrdenDeCompra = async (req, res) => {
  try {
    const { id: ocId } = req.params;
    const usuarioSira = req.usuarioSira;

    if (!ocId) {
      return res.status(400).json({ error: 'Se requiere el ID de la Orden de Compra.' });
    }

    const resultado = await ocAuthorizationService.authorizeAndDistributeOC(ocId, usuarioSira);
    res.status(200).json(resultado);

  } catch (error) {
    console.error(`Controlador: Error al autorizar la OC ID ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al autorizar la OC.' });
  }
};

/**
 * @route   GET /api/ocs/:id/pdf
 * @desc    Genera y devuelve el PDF de una OC específica para su descarga directa.
 * @access  Privado
 */
const descargarOcPdf = async (req, res) => {
    const { id: ocId } = req.params;
    try {
        // 1. Llamamos al servicio de PDF
        const pdfBuffer = await generatePurchaseOrderPdf(ocId); // No necesita 'client' aquí

        // 2. Obtenemos los datos para el nombre del archivo
        const ocDataQuery = await pool.query(
            `SELECT oc.numero_oc, p.marca AS proveedor_marca
             FROM ordenes_compra oc
             JOIN proveedores p ON oc.proveedor_id = p.id
             WHERE oc.id = $1;`, [ocId]);
        
        if (ocDataQuery.rows.length === 0) {
            return res.status(404).send('Orden de Compra no encontrada.');
        }
        const ocData = ocDataQuery.rows[0];
        
        // =================================================================
        // --- ¡CORRECCIÓN BUG "OC-OC-" (Paso 3)! ---
        // 'ocData.numero_oc' ahora es solo el NÚMERO (ej: 253),
        // por lo que AÑADIMOS el prefijo 'OC-' aquí.
        // =================================================================
        const pdfNameSafeMarca = (ocData.proveedor_marca || 'PROV').replace(/\s/g, '_');
        const fileName = `OC-${ocData.numero_oc}_${pdfNameSafeMarca}.pdf`; // Resultado: OC-253_SERROT.pdf

        // 3. Enviamos el archivo al cliente.
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        res.end(pdfBuffer);

    } catch (error) {
        console.error(`Error al generar el PDF para la OC ${ocId}:`, error);
        res.status(500).send('Error al generar el PDF.');
    }
};

// --- Exportaciones del Módulo ---
module.exports = {
  generarOrdenDeCompra,
  autorizarOrdenDeCompra,
  descargarOcPdf,
};