// C:\SIRA\backend\services\ocAuthorizationService.js
/**
 * =================================================================================================
 * SERVICIO: Orquestador de Órdenes de Compra (Versión 2.0 - Centralizada)
 * =================================================================================================
 * @file ocAuthorizationService.js
 * @description Servicio maestro que centraliza la CREACIÓN y AUTORIZACIÓN de OCs.
 * Este servicio reemplaza la lógica duplicada en 'vistoBueno.controller.js'
 * y la lógica obsoleta en 'ocCreationService.js'.
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('./purchaseOrderPdfService');
const { uploadOcToReqFolder, downloadFileBuffer } = require('./googleDrive');
const { sendEmailWithAttachments } = require('./emailService');

/**
 * @description Obtiene los correos de un grupo de notificación.
 */
const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
    const query = `
        SELECT u.correo FROM usuarios u
        JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
        JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
        WHERE ng.codigo = $1 AND u.activo = true;
    `;
    const result = await client.query(query, [codigoGrupo]);
    return result.rows.map(row => row.correo);
};

/**
 * =================================================================================================
 * --- ¡NUEVA FUNCIÓN MAESTRA! ---
 * =================================================================================================
 * @description Orquesta la CREACIÓN y distribución de una OC en una sola transacción.
 * Reemplaza a 'crearOrdenDeCompraDesdeRfq' y 'authorizeAndDistributeOC'.
 * @param {object} params
 * @param {number} params.rfqId - ID de la requisición (RFQ) de origen.
 * @param {number} params.usuarioId - ID del usuario que autoriza.
 * @param {Array<number>} params.opcionIds - IDs de las `requisiciones_opciones` seleccionadas.
 * @param {object} params.rfqData - Datos de la RFQ (depto_codigo, numero_requisicion).
 * @returns {Promise<object>} El objeto de la OC recién creada.
 */
const createAndAuthorizeOC = async ({ rfqId, usuarioId, opcionIds, rfqData }) => {
    if (!opcionIds || opcionIds.length === 0) {
        throw new Error("Se requiere al menos una opción seleccionada para generar la OC.");
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Obtener datos de las opciones seleccionadas
        const opcionesQuery = await client.query(
            `SELECT
                ro.*, -- Todos los campos de requisiciones_opciones
                rd.material_id,
                p.marca as proveedor_marca, 
                p.razon_social as proveedor_razon_social, 
                p.correo as proveedor_correo
            FROM requisiciones_opciones ro
            JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.id = ANY($1::int[]) AND ro.requisicion_id = $2`,
            [opcionIds, rfqId]
        );

        const items = opcionesQuery.rows;
        if (items.length === 0) {
            throw new Error("Las opciones seleccionadas no son válidas o no pertenecen al RFQ especificado.");
        }
        
        const primerItem = items[0];
        const { proveedor_id, proveedor_marca, proveedor_razon_social, proveedor_correo } = primerItem;

        // 2. Calcular totales
        const subTotal = items.reduce((sum, item) => (sum + (Number(item.cantidad_cotizada) || 0) * (Number(item.precio_unitario) || 0)), 0);
        const config = items[0]?.config_calculo || { isIvaActive: true, ivaRate: 0.16, isrRate: 0, isIsrActive: false };
        const iva = (config.isIvaActive) ? subTotal * (parseFloat(config.ivaRate) || 0.16) : 0;
        const retIsr = (config.isIsrActive) ? subTotal * (parseFloat(config.isrRate) || 0) : 0;
        const total = subTotal + iva - retIsr;
        const esImportacion = items.some(i => i.es_importacion);

        // 3. Insertar cabecera de OC
        const ocInsertResult = await client.query(
            `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id)
             VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10) RETURNING id, numero_oc`,
            [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, subTotal, iva, total, esImportacion, proveedor_id]
        );
        const nuevaOc = ocInsertResult.rows[0];
        const nuevaOcId = nuevaOc.id;

        // 4. Insertar detalle de OC (¡CON LÓGICA DE BLOQUEO CORRECTA!)
        for (const item of items) {
            await client.query(
                `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    nuevaOcId, 
                    item.requisicion_detalle_id, 
                    item.id, // <-- ID de la opción (requisiciones_opciones.id)
                    item.material_id, // <-- ID del material (catalogo_materiales.id)
                    item.cantidad_cotizada, 
                    item.precio_unitario, 
                    item.moneda, 
                    item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null
                ]
            );
            // Actualizar la línea de requisición
            await client.query(
                `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
                [nuevaOcId, item.requisicion_detalle_id]
            );
        }

        // 5. Generar PDF (Llama al servicio refactorizado)
        const pdfBuffer = await generatePurchaseOrderPdf(nuevaOcId);
        const pdfNameSafeMarca = (proveedor_marca || 'PROV').replace(/\s+/g, '_');
        const fileName = `OC-${nuevaOc.numero_oc}_${pdfNameSafeMarca}.pdf`;

        // 6. Subir a Drive (Llama al servicio refactorizado)
        const driveFile = await uploadOcToReqFolder(
            pdfBuffer,
            fileName,
            rfqData.depto_codigo,
            rfqData.numero_requisicion
        );
        if (!driveFile || !driveFile.fileLink) {
            throw new Error('Falló la subida del PDF a Drive o no se recibió el link de vuelta.');
        }

        // 7. Adjuntar cotizaciones
        const quoteFilesQuery = await client.query(
            `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
            [proveedor_id, rfqId]
        );
        const attachments = [];
        attachments.push({ filename: fileName, content: pdfBuffer }); // El PDF de la OC

        for (const file of quoteFilesQuery.rows) {
            try {
                const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
                const fileBuffer = await downloadFileBuffer(fileId);
                attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
            } catch (downloadError) {
                console.error(`No se pudo adjuntar el archivo ${file.nombre_archivo} de Drive.`, downloadError);
            }
        }

        // 8. Enviar email (con firma)
        const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
        if (recipients.length > 0) {
            const subject = `OC Generada para Autorización: ${nuevaOc.numero_oc} (${proveedor_razon_social})`;
            const htmlBody = `
                <p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p>
                <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
                <p>Link a Carpeta de Drive: <a href="${driveFile.folderLink}">Ver Archivos</a></p>
            `;
            await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
        }
        
        await client.query('COMMIT');
        
        return {
            ...nuevaOc,
            mensaje: `OC ${nuevaOc.numero_oc} generada y enviada.`
        };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[OC Service] Error en transacción:', err);
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { 
    createAndAuthorizeOC,
    // (Mantenemos la función original por si 'ocAuthorizationService.js' se usa en otro lugar)
    authorizeAndDistributeOC: require('./ocAuthorizationService').authorizeAndDistributeOC 
};