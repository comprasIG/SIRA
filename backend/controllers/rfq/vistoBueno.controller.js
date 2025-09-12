//C:\SIRA\backend\controllers\rfq\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Visto Bueno de Cotizaciones (VB_RFQ) - Versión Final
 * =================================================================================================
 * @file vistoBueno.controller.js
 * @description Maneja las acciones del gerente en la pantalla de Visto Bueno de RFQs,
 * incluyendo la generación de OCs con la lógica para adjuntar las cotizaciones
 * de respaldo al correo de notificación.
 */

// --- Importaciones de Módulos y Servicios ---
const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
// Se importan las funciones necesarias de Drive y Email
const { uploadPdfBuffer, downloadFileBuffer } = require('../../services/googleDrive');
const { sendEmailWithAttachments } = require('../../services/emailService');


// ===============================================================================================
// --- SECCIÓN 1: Funciones de Ayuda (Helpers) ---
// ===============================================================================================

/**
 * @description Obtiene los correos de un grupo de notificación desde la BD.
 * @param {string} codigoGrupo - El código único del grupo (ej. 'OC_GENERADA_NOTIFICAR').
 * @param {object} client - El cliente de la base de datos para la transacción.
 * @returns {Promise<string[]>} Un arreglo de correos electrónicos.
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


// ===============================================================================================
// --- SECCIÓN 2: Controladores Exportados ---
// ===============================================================================================

/**
 * @route GET /api/rfq/por-aprobar
 * @description Obtiene la lista de RFQs que están pendientes de Visto Bueno.
 */
const getRfqsPorAprobar = async (req, res) => {
    try {
        const query = `
          SELECT r.id, r.rfq_code, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
          FROM requisiciones r
          JOIN usuarios u ON r.usuario_id = u.id
          JOIN proyectos p ON r.proyecto_id = p.id
          JOIN sitios s ON r.sitio_id = s.id
          WHERE r.status = 'POR_APROBAR' ORDER BY r.fecha_creacion ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener RFQs por aprobar:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route POST /api/rfq/:id/rechazar
 * @description Devuelve un RFQ al estado 'COTIZANDO' para su corrección.
 */
const rechazarRfq = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE requisiciones SET status = 'COTIZANDO' WHERE id = $1 AND status = 'POR_APROBAR' RETURNING id`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El RFQ no se encontró o ya no está en estado para ser rechazado.' });
        }
        res.status(200).json({ mensaje: 'El RFQ ha sido devuelto a cotización.' });
    } catch (error) {
        console.error(`Error al rechazar RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route POST /api/rfq/:id/generar-ocs
 * @description Función principal del gerente para generar una o más OCs desde un RFQ.
 */
const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { proveedorId } = req.body; // Acepta un proveedorId opcional para procesar solo una OC
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Validar y bloquear el RFQ para evitar procesamientos duplicados.
        const rfqQuery = await client.query(`SELECT r.*, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'POR_APROBAR' FOR UPDATE`, [rfqId]);
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        const rfqData = rfqQuery.rows[0];

        // 2. Encontrar las opciones "ganadoras" seleccionadas por el comprador.
        let opcionesQueryString = `SELECT ro.*, p.marca as proveedor_marca, p.razon_social as proveedor_razon_social, p.correo as proveedor_correo FROM requisiciones_opciones ro JOIN proveedores p ON ro.proveedor_id = p.id WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE`;
        const queryParams = [rfqId];
        if (proveedorId) {
            opcionesQueryString += ` AND ro.proveedor_id = $2`;
            queryParams.push(proveedorId);
        }
        const opcionesQuery = await client.query(opcionesQueryString, queryParams);
        if (opcionesQuery.rows.length === 0) throw new Error('No se encontraron opciones seleccionadas para generar OCs.');
        
        // 3. Agrupar por proveedor para crear una OC por cada uno.
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        // 4. Iterar sobre cada proveedor y procesar su OC.
        for (const provId in comprasPorProveedor) {
            const items = comprasPorProveedor[provId];
            const primerItem = items[0];

            // a. Crear la cabecera y detalle de la OC en la base de datos.
            const ocInsertResult = await client.query(`INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id) VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10) RETURNING id`, [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, primerItem.subtotal, primerItem.iva, primerItem.total, items.some(i => i.es_importacion), provId]);
            const nuevaOcId = ocInsertResult.rows[0].id;
            for (const item of items) {
                await client.query(`INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega) VALUES ($1, $2, $3, (SELECT material_id FROM requisiciones_detalle WHERE id=$2), $4, $5, $6, $7)`, [nuevaOcId, item.requisicion_detalle_id, item.id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null]);
                await client.query(`UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`, [nuevaOcId, item.requisicion_detalle_id]);
            }

            // b. Recolectar datos y generar el PDF de la OC.
            const ocDataParaPdf = (await client.query(`SELECT oc.*, p.razon_social AS proveedor_razon_social, p.rfc AS proveedor_rfc, proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre as usuario_nombre, (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda, NOW() as fecha_aprobacion FROM ordenes_compra oc JOIN proveedores p ON oc.proveedor_id = p.id JOIN proyectos proy ON oc.proyecto_id = proy.id JOIN sitios s ON oc.sitio_id = s.id JOIN usuarios u ON oc.usuario_id = u.id WHERE oc.id = $1;`, [nuevaOcId])).rows[0];
            const itemsDataParaPdf = (await client.query(`SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo FROM ordenes_compra_detalle ocd JOIN catalogo_materiales cm ON ocd.material_id = cm.id JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id WHERE ocd.orden_compra_id = $1;`, [nuevaOcId])).rows;
            const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, itemsDataParaPdf);
            const fileName = `OC-${ocDataParaPdf.numero_oc}_${primerItem.proveedor_marca}.pdf`;
            const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, 'ORDENES DE COMPRA (PDF)', ocDataParaPdf.numero_oc);
            
            // c. Preparar adjuntos para el correo: la OC y sus cotizaciones de respaldo.
            const attachments = [{ filename: fileName, content: pdfBuffer, contentType: 'application/pdf' }];
            const quoteFilesQuery = await client.query(`SELECT nombre_archivo, ruta_archivo FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1 AND proveedor_id = $2`, [rfqId, provId]);
            for (const file of quoteFilesQuery.rows) {
                try {
                    const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
                    const fileBuffer = await downloadFileBuffer(fileId);
                    attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
                } catch (downloadError) {
                    console.error(`No se pudo adjuntar el archivo ${file.nombre_archivo} de Drive. El proceso continuará sin él.`, downloadError);
                }
            }
            
            // d. Enviar correo de notificación al grupo dinámico.
            const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
            if (recipients.length > 0) {
                const subject = `OC Generada para Autorización: ${ocDataParaPdf.numero_oc} (${primerItem.proveedor_razon_social})`;
                const htmlBody = `<p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p><p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p><p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>`;
                await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
            }
            
            ocsGeneradasInfo.push({ numero_oc: ocDataParaPdf.numero_oc, id: nuevaOcId });
        }

        // 5. Verificar si el RFQ está completo para actualizar su estado.
        const checkCompletion = await client.query(`SELECT COUNT(*) FROM requisiciones_detalle WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`, [rfqId]);
        if (checkCompletion.rows[0].count === '0') {
            await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
        }
        
        await client.query('COMMIT');
        res.status(200).json({ 
            mensaje: `Proceso completado. OCs generadas: ${ocsGeneradasInfo.map(oc => oc.numero_oc).join(', ')}.`,
            ocs: ocsGeneradasInfo 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al generar OCs para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};


// ===============================================================================================
// --- SECCIÓN 3: Exportaciones del Módulo ---
// ===============================================================================================
module.exports = {
    getRfqsPorAprobar,
    rechazarRfq,
    generarOcsDesdeRfq,
};