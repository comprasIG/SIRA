//C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Versión 2.0 - Centralizada)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Maneja las peticiones HTTP para OCs.
 * ¡CAMBIO! Ahora utiliza el servicio central 'ocAuthorizationService'.
 */

// --- Importaciones de Módulos y Servicios ---
const pool = require('../db/pool');
// --- ¡CAMBIO! Se elimina 'ocCreationService' y se usa el orquestador ---
const { createAndAuthorizeOC, authorizeAndDistributeOC } = require('../services/ocAuthorizationService');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');


// ===============================================================================================
// --- Funciones del Controlador ---
// ===============================================================================================

/**
 * @route   POST /api/ocs/rfq/:rfqId/generar-oc
 * @desc    Crea, autoriza y distribuye una nueva OC desde un RFQ.
 * @access  Privado
 */
const generarOrdenDeCompra = async (req, res) => {
  try {
    const { rfqId } = req.params;
    const { opcionIds } = req.body;
    const { id: usuarioId } = req.usuarioSira;

    if (!opcionIds || !Array.isArray(opcionIds) || opcionIds.length === 0) {
      return res.status(400).json({ error: "Se requiere un arreglo con los IDs de las opciones seleccionadas." });
    }
    
    // --- ¡CAMBIO! ---
    // 1. Obtener los datos de ruta de la RFQ (necesarios para Drive)
    const rfqQuery = await pool.query(
        `SELECT r.numero_requisicion, r.rfq_code, r.lugar_entrega, r.sitio_id, r.proyecto_id,
                d.codigo as depto_codigo 
         FROM requisiciones r 
         JOIN departamentos d ON r.departamento_id = d.id 
         WHERE r.id = $1`, [rfqId]
    );
    if (rfqQuery.rowCount === 0) throw new Error('El RFQ base no existe.');
    
    // 2. Llamar al NUEVO servicio orquestador
    const nuevaOc = await createAndAuthorizeOC({
      rfqId,
      usuarioId,
      opcionIds,
      rfqData: rfqQuery.rows[0] // Pasar los datos de ruta
    });
    // --- FIN CAMBIO ---

    res.status(201).json({
      mensaje: `Orden de Compra ${nuevaOc.numero_oc} generada exitosamente.`,
      ordenDeCompra: nuevaOc,
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
    
    // (Esta función no cambia, ya llamaba al servicio correcto)
    const resultado = await authorizeAndDistributeOC(ocId, usuarioSira);
    res.status(200).json(resultado);

  } catch (error) {
    console.error(`Controlador: Error al autorizar la OC ID ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al autorizar la OC.' });
  }
};

/**
 * @route   GET /api/ocs/:id/pdf
 * @desc    Genera y devuelve el PDF de una OC específica.
 * @access  Privado
 */
const descargarOcPdf = async (req, res) => {
    const { id: ocId } = req.params;
    try {
        // --- ¡CAMBIO! ---
        // Se llama al servicio refactorizado que hace la consulta interna.
        // Ya no necesitamos consultar la BD aquí.
        const pdfBuffer = await generatePurchaseOrderPdf(ocId);
        
        // (El nombre del archivo se deduce en el servicio, pero
        // para la descarga necesitamos consultarlo aquí de nuevo)
        const ocDataQuery = await pool.query(
            `SELECT oc.numero_oc, p.marca AS proveedor_marca
             FROM ordenes_compra oc
             JOIN proveedores p ON oc.proveedor_id = p.id
             WHERE oc.id = $1;`, [ocId]);
        
        if (ocDataQuery.rows.length === 0) {
            return res.status(404).send('Orden de Compra no encontrada.');
        }
        const ocData = ocDataQuery.rows[0];
        const fileName = `OC-${ocData.numero_oc}_${(ocData.proveedor_marca || 'PROV').replace(/\s/g, '_')}.pdf`;

        // 4. Enviamos el archivo al cliente.
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