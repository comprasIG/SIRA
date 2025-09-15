/**
 * ================================================================================================
 * CONTROLADOR: Visto Bueno de Cotizaciones (VB_RFQ) - Versión Completa y Documentada
 * ================================================================================================
 * @file vistoBueno.controller.js
 * @description Gerente genera OCs, adjunta PDF y cotizaciones, sube a Drive y notifica por email.
 */

const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
const { uploadPdfBuffer, downloadFileBuffer } = require('../../services/googleDrive');
const { sendEmailWithAttachments } = require('../../services/emailService');

/* ================================================================================================
 * SECCIÓN 1: Helpers
 * ==============================================================================================*/

/**
 * Obtiene los correos electrónicos de un grupo de notificación.
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
 * Genera una OC para cada proveedor solo con las líneas pendientes (NO bloqueadas).
 * Adjunta PDF, archivos de respaldo, sube a Drive, y manda email.
 */
const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { proveedorId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- 1. Validar RFQ ---
        const rfqQuery = await client.query(
            `SELECT r.*, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'POR_APROBAR' FOR UPDATE`, [rfqId]
        );
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        const rfqData = rfqQuery.rows[0];

        // --- 2. Buscar opciones seleccionadas NO bloqueadas ---
        // Opciones bloqueadas = las que YA tienen OC, estas NO se deben incluir
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
        // Solo incluir NO bloqueadas
        if (opcionesBloqueadas.length > 0) {
            opcionesQueryString += ` AND ro.id NOT IN (${opcionesBloqueadas.join(',')})`;
        }
        const opcionesQuery = await client.query(opcionesQueryString, queryParams);
        if (opcionesQuery.rows.length === 0) throw new Error('No hay opciones pendientes para generar OC para este proveedor.');

        // --- 3. Agrupar por proveedor (SOLO los items pendientes, no bloqueados) ---
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        // --- 4. Procesar cada proveedor (solo items que no tengan OC previa) ---
        for (const provId in comprasPorProveedor) {
            const items = comprasPorProveedor[provId];
            const primerItem = items[0];

            // Calcular totales de OC (solo de items pendientes)
            const subTotal = items.reduce((acc, x) => acc + Number(x.cantidad_cotizada) * Number(x.precio_unitario), 0);
            const iva = items.some(x => x.config_calculo?.isIvaActive === false) ? 0 : subTotal * 0.16;
            const total = subTotal + iva;

            // --- 4A. Crear OC (solo con los items pendientes, no bloqueados) ---
            const ocInsertResult = await client.query(
                `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id)
                 VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10) RETURNING id, numero_oc`,
                [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, subTotal, iva, total, items.some(i => i.es_importacion), provId]
            );
            const nuevaOcId = ocInsertResult.rows[0].id;
            const nuevoNumeroOc = ocInsertResult.rows[0].numero_oc;

            // --- 4B. Insertar detalle de OC y actualizar requisiciones ---
            for (const item of items) {
                await client.query(
                    `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
                     VALUES ($1, $2, $3, (SELECT material_id FROM requisiciones_detalle WHERE id=$2), $4, $5, $6, $7)`,
                    [nuevaOcId, item.requisicion_detalle_id, item.id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null]
                );
                await client.query(
                    `UPDATE requisiciones_detalle SET cantidad_procesada = cantidad_procesada + $1 WHERE id = $2`,
                    [item.cantidad_cotizada, item.requisicion_detalle_id]
                );
                await client.query(
                    `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2 AND cantidad_procesada >= cantidad`,
                    [nuevaOcId, item.requisicion_detalle_id]
                );
            }

            // --- 4C. PDF de OC ---
         // -------------------------------------------------------------------------------------
// 4C. PREPARAR LOS DATOS PARA EL PDF DE ORDEN DE COMPRA (OC)
// -------------------------------------------------------------------------------------

// 1. Sacar los material_id únicos de los items de la OC (requisiciones_opciones)
const materialIds = [...new Set(items.map(i => Number(i.material_id)).filter(x => !!x && !isNaN(x)))];

// 2. Traer el nombre y la unidad de TODOS los materiales involucrados en la OC
let materialInfoMap = {};
if (materialIds.length > 0) {
    // OJO: nombre viene de catalogo_materiales y unidad (símbolo) de catalogo_unidades
    const materialesResult = await client.query(
        `SELECT m.id, m.nombre, u.simbolo as unidad
         FROM catalogo_materiales m
         JOIN catalogo_unidades u ON m.unidad_de_compra = u.id
         WHERE m.id = ANY($1::int[])`,
        [materialIds]
    );
    // Mapeo para acceso rápido por id
    materialInfoMap = Object.fromEntries(materialesResult.rows.map(row => [Number(row.id), row]));
}

// 3. Armar el array de items exactamente como lo espera tu plantilla de PDF
const pdfItems = items.map(i => ({
    ...i,
    material: materialInfoMap[Number(i.material_id)]?.nombre || 'Material desconocido',
    unidad: materialInfoMap[Number(i.material_id)]?.unidad || '',
    cantidad: i.cantidad_cotizada,
    precio_unitario: i.precio_unitario,
    total: (Number(i.cantidad_cotizada) * Number(i.precio_unitario)).toFixed(2),
}));

// 4. Armar el objeto final para el PDF (asegúrate que los nombres de propiedades coincidan con lo que lee tu servicio PDF)
const ocDataParaPdf = {
    numero_oc: nuevoNumeroOc,
    proveedor: primerItem.proveedor_razon_social,
    items: pdfItems,  // El array que tu PDF espera
    subTotal,
    iva,
    total,
};

// Log de depuración (esto te muestra en consola lo que realmente se manda al PDF)
console.log('DEBUG PDF DATA', ocDataParaPdf);

// 5. Generar el PDF usando el servicio
const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, ocDataParaPdf.items);

            // --- 4D. Subir PDF a Drive ---
// --- 4D. Subir PDF a Drive ---
const driveFile = await uploadPdfBuffer(
    pdfBuffer,                          // 1. El contenido del PDF
    `OC_${nuevoNumeroOc}.pdf`,          // 2. El nombre del archivo
    'ORDENES_DE_COMPRA_PDF',            // 3. Carpeta Raíz
    rfqData.rfq_code                    // 4. Sub-Carpeta (el código del RFQ)
);

// --- VALIDACIÓN ROBUSTA ---
if (!driveFile || !driveFile.webViewLink) {
    throw new Error('Falló la subida del archivo PDF a Google Drive o no se recibió el link de vuelta.');
}

// --- 4E. Adjuntar archivos de cotización del proveedor a la OC (Drive) ---
const quoteFilesQuery = await client.query(
    `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
    [provId, rfqId]
);
const attachments = [];
// PDF OC principal
attachments.push({ filename: `OC_${nuevoNumeroOc}.pdf`, content: pdfBuffer });

for (const file of quoteFilesQuery.rows) {
    try {
        const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
        const fileBuffer = await downloadFileBuffer(fileId);
        attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
    } catch (downloadError) {
        console.error(`No se pudo adjuntar el archivo ${file.nombre_archivo} de Drive. El proceso continuará sin él.`, downloadError);
    }
}

// --- 4F. Notificar por correo al grupo ---
const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
if (recipients.length > 0) {
    const subject = `OC Generada para Autorización: ${nuevoNumeroOc} (${primerItem.proveedor_razon_social})`;
    const htmlBody = `
        <p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p>
        <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
        <p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>
    `;
    await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
}

            ocsGeneradasInfo.push({ numero_oc: nuevoNumeroOc, id: nuevaOcId });
        }

        // --- 5. Actualizar status del RFQ si ya no hay líneas pendientes ---
        const checkCompletion = await client.query(
            `SELECT COUNT(*) FROM requisiciones_detalle WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`, [rfqId]
        );
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

/* ================================================================================================
 * SECCIÓN 3: Exportación del Módulo
 * ==============================================================================================*/
module.exports = {
    getRfqsPorAprobar,
    rechazarRfq,
    generarOcsDesdeRfq,
};
