//C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Acciones Específicas)
 * =================================================================================================
 * @file ordenCompra.controller.js
 * @description Maneja las peticiones HTTP para acciones específicas sobre Órdenes de Compra,
 * como la generación, autorización y descarga de PDFs.
 */

// --- Importaciones de Módulos y Servicios ---
const pool = require('../db/pool');
const ocCreationService = require('../services/ocCreationService');
const ocAuthorizationService = require('../services/ocAuthorizationService');
// ¡NUEVO! Se importa el servicio de generación de PDFs
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

    const resultado = await ocAuthorizationService.authorizeAndDistributeOC(ocId, usuarioSira);
    res.status(200).json(resultado);

  } catch (error) {
    console.error(`Controlador: Error al autorizar la OC ID ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al autorizar la OC.' });
  }
};

/**
 * ===============================================================================================
 * --- ¡NUEVA FUNCIÓN PARA DESCARGA! ---
 * ===============================================================================================
 * @route   GET /api/ocs/:id/pdf
 * @desc    Genera y devuelve el PDF de una OC específica para su descarga directa.
 * @access  Privado
 */
const descargarOcPdf = async (req, res) => {
    const { id: ocId } = req.params;
    try {
        // --- ¡LA CORRECCIÓN ESTÁ AQUÍ! ---
        // 1. Obtenemos los datos completos de la cabecera de la OC, igual que en el otro controlador.
        const ocDataQuery = await pool.query(`
            SELECT oc.*, p.razon_social AS proveedor_razon_social, p.marca AS proveedor_marca, p.rfc AS proveedor_rfc,
                   proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre as usuario_nombre,
                   (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda,
                   NOW() as fecha_aprobacion
            FROM ordenes_compra oc
            JOIN proveedores p ON oc.proveedor_id = p.id
            JOIN proyectos proy ON oc.proyecto_id = proy.id
            JOIN sitios s ON oc.sitio_id = s.id
            JOIN usuarios u ON oc.usuario_id = u.id
            WHERE oc.id = $1;
        `, [ocId]);

        if (ocDataQuery.rows.length === 0) {
            return res.status(404).send('Orden de Compra no encontrada.');
        }
        const ocData = ocDataQuery.rows[0];

        // 2. Obtenemos los materiales (items) de esa OC.
        const itemsDataQuery = await pool.query(`
            SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo
            FROM ordenes_compra_detalle ocd
            JOIN catalogo_materiales cm ON ocd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE ocd.orden_compra_id = $1;
        `, [ocId]);
        const itemsData = itemsDataQuery.rows;

        const fileName = `OC-${ocData.numero_oc}_${ocData.proveedor_marca.replace(/\s/g, '_')}.pdf`;

        // 3. Llamamos al servicio de PDF pasándole AMBOS datos.
        const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData);

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
  descargarOcPdf, // <-- Se exporta la nueva función
};