// C:\SIRA\backend\controllers\rfq\vistoBueno.controller.js
/**
 * ================================================================================================
 * CONTROLADOR: Visto Bueno de Cotizaciones (VB_RFQ) - Versión 4.1 (Corrección TX y Nombres)
 * ================================================================================================
 * @file vistoBueno.controller.js
 * @description Corregido para pasar el 'client' de transacción al servicio de PDF
 * (evitando el ROLLBACK y el salto de IDs) y corregido el nombre duplicado 'OC-OC-'.
 */

const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
const { uploadOcToReqFolder, downloadFileBuffer } = require('../../services/googleDrive');
const { sendEmailWithAttachments } = require('../../services/emailService');

/* ================================================================================================
 * SECCIÓN 1: Helpers
 * ==============================================================================================*/
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

/* ================================================================================================
 * SECCIÓN 2: Endpoints de VB_RFQ
 * ==============================================================================================*/

/**
 * GET /api/rfq/por-aprobar
 */
const getRfqsPorAprobar = async (req, res) => {
    try {
        const query = `
          SELECT r.id, r.rfq_code, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
          FROM requisiciones r
          JOIN usuarios u ON r.usuario_id = u.id
          JOIN proyectos p ON r.proyecto_id = p.id
          JOIN sitios s ON r.sitio_id = s.id
          WHERE r.status = 'POR_APROBAR'
          ORDER BY r.fecha_creacion ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener RFQs por aprobar:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/rfq/:id/rechazar
 */
const rechazarRfq = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'COTIZANDO' WHERE id = $1 AND status = 'POR_APROBAR' RETURNING id`, [id]
        );
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
 * POST /api/rfq/:id/generar-ocs
 * ¡Función crítica refactorizada!
 */
const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { proveedorId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- 1. Validar RFQ y OBTENER DATOS DE RUTA ---
        const rfqQuery = await client.query(
            `SELECT r.numero_requisicion, r.rfq_code, r.lugar_entrega, r.sitio_id, r.proyecto_id,
                    d.codigo as depto_codigo
             FROM requisiciones r 
             JOIN departamentos d ON r.departamento_id = d.id 
             WHERE r.id = $1 AND r.status = 'POR_APROBAR' FOR UPDATE`, [rfqId]
        );
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        
        const rfqData = rfqQuery.rows[0];
        const { numero_requisicion, depto_codigo } = rfqData;

        // --- 2. Buscar opciones seleccionadas NO bloqueadas ---
        const opcionesBloqueadasQuery = await client.query(
            `SELECT comparativa_precio_id FROM ordenes_compra_detalle 
             WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE rfq_id = $1)`, [rfqId]
        );
        const opcionesBloqueadas = opcionesBloqueadasQuery.rows.map(row => Number(row.comparativa_precio_id));

        let opcionesQueryString = `
            SELECT ro.*, p.marca as proveedor_marca, p.razon_social as proveedor_razon_social, p.correo as proveedor_correo 
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE
        `;
        const queryParams = [rfqId];
        if (proveedorId) {
            opcionesQueryString += ` AND ro.proveedor_id = $2`;
            queryParams.push(proveedorId);
        }
        if (opcionesBloqueadas.length > 0) {
            opcionesQueryString += ` AND ro.id NOT IN (${opcionesBloqueadas.join(',')})`;
        }
        const opcionesQuery = await client.query(opcionesQueryString, queryParams);
        if (opcionesQuery.rows.length === 0) throw new Error('No hay opciones pendientes para generar OC para este proveedor.');

        // --- 3. Agrupar por proveedor ---
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        // --- 4. Procesar cada proveedor ---
        for (const provId in comprasPorProveedor) {
            const items = comprasPorProveedor[provId];
            const primerItem = items[0];

            // --- 4A. Calcular totales ---
            const subTotal = items.reduce((sum, item) => (sum + (Number(item.cantidad_cotizada) || 0) * (Number(item.precio_unitario) || 0)), 0);
            const config = items[0]?.config_calculo || { isIvaActive: true, ivaRate: 0.16, isrRate: 0, isIsrActive: false };
            const iva = (config.isIvaActive) ? subTotal * (parseFloat(config.ivaRate) || 0.16) : 0;
            const retIsr = (config.isIsrActive) ? subTotal * (parseFloat(config.isrRate) || 0) : 0;
            const total = subTotal + iva - retIsr;
            const esImportacion = items.some(i => i.es_importacion);

            // =================================================================
            // --- ¡CORRECCIÓN BUG "OC-OC-" (Paso 1)! ---
            // Se quita el prefijo 'OC-' del INSERT. Ahora la BD solo guarda el NÚMERO.
            // =================================================================
            const ocInsertResult = await client.query(
                `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id)
                 VALUES (nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10) RETURNING id, numero_oc`,
                [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, subTotal, iva, total, esImportacion, provId]
            );
            const nuevaOcId = ocInsertResult.rows[0].id;
            const nuevoNumeroOc = ocInsertResult.rows[0].numero_oc; // Esto ahora es solo un NÚMERO (ej: 254)

            // --- 4C. Insertar detalle de OC (Lógica de bloqueo) ---
            for (const item of items) {
                const detReqQuery = await client.query('SELECT material_id FROM requisiciones_detalle WHERE id = $1', [item.requisicion_detalle_id]);
                const material_id = detReqQuery.rows[0]?.material_id;
                if (!material_id) throw new Error(`No se pudo encontrar el material_id para el detalle de requisición ${item.requisicion_detalle_id}`);

                await client.query(
                    `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        nuevaOcId, 
                        item.requisicion_detalle_id, 
                        item.id,
                        material_id,
                        item.cantidad_cotizada, 
                        item.precio_unitario, 
                        item.moneda, 
                        item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null
                    ]
                );
                await client.query(
                    `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
                    [nuevaOcId, item.requisicion_detalle_id]
                );
            }

            // =================================================================
            // --- ¡CORRECCIÓN BUG SALTO DE ID (Paso 1)! ---
            // Se pasa el 'client' de la transacción al servicio de PDF.
            // =================================================================
            const pdfBuffer = await generatePurchaseOrderPdf(nuevaOcId, client);
            
            // =================================================================
            // --- ¡CORRECCIÓN BUG "OC-OC-" (Paso 2)! ---
            // Ahora 'nuevoNumeroOc' es solo el NÚMERO (ej: 254),
            // por lo que AÑADIMOS el prefijo 'OC-' aquí.
            // =================================================================
            const pdfNameSafeMarca = (primerItem.proveedor_marca || 'PROV').replace(/\s+/g, '_');
            const fileName = `OC-${nuevoNumeroOc}_${pdfNameSafeMarca}.pdf`; // Resultado: OC-254_SERROT.pdf

            // --- 4D. Subir a Drive (Sin cambios, ya estaba bien) ---
            const driveFile = await uploadOcToReqFolder(
                pdfBuffer,
                fileName,
                depto_codigo,
                numero_requisicion
            );
            if (!driveFile || !driveFile.fileLink) {
                throw new Error('Falló la subida del PDF a Drive o no se recibió el link de vuelta.');
            }

            // --- 4E. Adjuntar cotizaciones (Sin cambios) ---
            const quoteFilesQuery = await client.query(
                `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
                [provId, rfqId]
            );
            const attachments = [];
            attachments.push({ filename: fileName, content: pdfBuffer }); 

            for (const file of quoteFilesQuery.rows) {
                try {
                    const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
                    const fileBuffer = await downloadFileBuffer(fileId);
                    attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
                } catch (downloadError) {
                    console.error(`No se pudo adjuntar el archivo ${file.nombre_archivo} de Drive.`, downloadError);
                }
            }

            // --- 4F. Notificar por correo ---
            const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
            if (recipients.length > 0) {
                // Usamos el nombre 'OC-254' para el Asunto
                const subject = `OC Generada para Autorización: OC-${nuevoNumeroOc} (${primerItem.proveedor_razon_social})`;
                const htmlBody = `
                    <p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p>
                    <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
                    <p>Link a Carpeta de Drive: <a href="${driveFile.folderLink}">Ver Archivos</a></p>
                `;
                await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
            }

            ocsGeneradasInfo.push({ numero_oc: `OC-${nuevoNumeroOc}`, id: nuevaOcId });
        }

        // --- 5. Actualizar status del RFQ (Sin cambios) ---
        const checkCompletion = await client.query(
            `SELECT COUNT(*) FROM requisiciones_detalle WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`, [rfqId]
        );
        if (checkCompletion.rows[0].count === '0') {
            await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
        }

        // --- ¡COMMIT! ---
        await client.query('COMMIT');
        
        res.status(200).json({
            mensaje: `Proceso completado. OCs generadas: ${ocsGeneradasInfo.map(oc => oc.numero_oc).join(', ')}.`,
            ocs: ocsGeneradasInfo
        });

    } catch (error) {
        // --- ROLLBACK (Esto era lo que causaba el salto de IDs) ---
        await client.query('ROLLBACK');
        console.error(`Error al generar OCs para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

/* ================================================================================================
 * SECCIÓN 3: Exportación del Módulo
 * ==============================================================================================*/
module.exports = {
    getRfqsPorAprobar,
    rechazarRfq,
    generarOcsDesdeRfq,
};