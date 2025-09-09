// C:/SIRA/backend/controllers/rfq.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Solicitudes de Cotización (RFQs)
 * =================================================================================================
 * @file rfq.controller.js
 * @description Maneja toda la lógica de negocio para el ciclo de vida de las RFQs,
 * desde la consulta de listas pendientes hasta el guardado de cotizaciones
 * y el proceso de aprobación para generar Órdenes de Compra.
 */

// --- Importaciones de Módulos ---
const pool = require('../db/pool');
const { uploadQuoteFiles } = require('../services/googleDrive');

const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');
const { uploadPdfBuffer } = require('../services/googleDrive');
const { sendRequisitionEmail } = require('../services/emailService');

// =================================================================================================
// SECCIÓN 1: OBTENCIÓN DE LISTAS DE RFQs
// =================================================================================================

/**
 * @route GET /api/rfq/pendientes
 * @description Obtiene todas las requisiciones que tienen el estatus 'COTIZANDO',
 * es decir, aquellas que están pendientes de ser trabajadas por el equipo de Compras.
 */
const getRequisicionesCotizando = async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.rfq_code, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio, r.lugar_entrega
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.status = 'COTIZANDO' ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones en cotización:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * @route GET /api/rfq/por-aprobar
 * @description Obtiene la lista de RFQs que ya han sido cotizadas y están
 * pendientes del Visto Bueno ('POR_APROBAR') por parte de un gerente.
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
  } catch (error)
{
    console.error("Error al obtener RFQs por aprobar:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// =================================================================================================
// SECCIÓN 2: OBTENCIÓN DEL DETALLE DE UN RFQ
// =================================================================================================

/**
 * @route GET /api/rfq/:id
 * @description Obtiene todos los detalles de un RFQ específico, incluyendo
 * información general, materiales, opciones de cotización guardadas y archivos adjuntos.
 */
const getRfqDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener datos de la cabecera de la requisición.
        const reqResult = await pool.query(`
            SELECT r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            WHERE r.id = $1;
        `, [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Requisición no encontrada.' });

        // 2. Obtener las líneas de materiales.
        const materialesResult = await pool.query(`
            SELECT rd.id, rd.cantidad, rd.comentario, cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
        `, [id]);

        // 3. Obtener las opciones de cotización ya guardadas.
        const opcionesResult = await pool.query(`
            SELECT ro.*, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `, [id]);
        
        // 4. Obtener los archivos adjuntos.
        const adjuntosResult = await pool.query(
            `SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        // 5. Unir los materiales con sus respectivas opciones.
        const materialesConOpciones = materialesResult.rows.map(material => ({
            ...material,
            opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id)
        }));
        
        // 6. Enviar la respuesta completa y estructurada.
        res.json({ 
            ...reqResult.rows[0], 
            materiales: materialesConOpciones,
            adjuntos: adjuntosResult.rows
        });
    } catch (error) {
        console.error(`Error al obtener detalle de RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

// =================================================================================================
// SECCIÓN 3: ACCIONES DEL COMPRADOR (Formulario G_RFQ)
// =================================================================================================

/**
 * @route POST /api/rfq/:id/opciones
 * @description Guarda o actualiza las opciones de cotización para un RFQ.
 * Esta es la versión mejorada que almacena todos los detalles financieros y de configuración.
 */
const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    let { opciones, resumenes, rfq_code } = req.body;

    try {
        // El frontend envía los datos como strings JSON dentro del FormData, por lo que se parsean.
        opciones = JSON.parse(opciones);
        resumenes = JSON.parse(resumenes);
    } catch {
        return res.status(400).json({ error: "El formato de 'opciones' o 'resumenes' no es un JSON válido." });
    }

    if (!Array.isArray(opciones)) return res.status(400).json({ error: "Se requiere un array de 'opciones'." });
    if (!Array.isArray(resumenes)) return res.status(400).json({ error: "Se requiere un array de 'resumenes'." });
    
    // Se crea un mapa de los resúmenes por ID de proveedor para una búsqueda eficiente.
    const resumenMap = new Map(resumenes.map(r => [r.proveedorId, r]));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Estrategia "reemplazar": se eliminan las opciones anteriores para evitar inconsistencias.
        await client.query(`DELETE FROM requisiciones_opciones WHERE requisicion_id = $1`, [requisicion_id]);
        
        for (const opt of opciones) {
             if (!opt.proveedor_id) continue; // Ignorar opciones sin proveedor.
            
             const resumenProveedor = resumenMap.get(opt.proveedor_id);

             // Query de inserción que ahora incluye todas las nuevas columnas.
             await client.query(
                `INSERT INTO requisiciones_opciones (
                    requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada, moneda, 
                    seleccionado, es_precio_neto, es_importacion, es_entrega_inmediata, 
                    tiempo_entrega_valor, tiempo_entrega_unidad,
                    subtotal, iva, ret_isr, total,
                    config_calculo, es_total_forzado
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                 )`,
                [
                    requisicion_id, opt.requisicion_detalle_id, opt.proveedor_id, opt.precio_unitario, 
                    opt.cantidad_cotizada, opt.moneda || 'MXN', opt.seleccionado, opt.es_precio_neto, 
                    opt.es_importacion, opt.es_entrega_inmediata,
                    opt.tiempo_entrega_valor || null, opt.tiempo_entrega_unidad || null,
                    // Si la opción fue seleccionada ("Elegir"), se guardan los datos del resumen.
                    opt.seleccionado ? resumenProveedor?.subTotal : null,
                    opt.seleccionado ? resumenProveedor?.iva : null,
                    opt.seleccionado ? resumenProveedor?.retIsr : null,
                    opt.seleccionado ? resumenProveedor?.total : null,
                    opt.seleccionado ? resumenProveedor?.config : null, 
                    opt.seleccionado ? resumenProveedor?.config?.isForcedTotalActive : false
                ]
            );
        }

        // La lógica de archivos no necesita cambios.
        if (req.files && req.files.length > 0) {
            // ... (código existente para subir archivos a Google Drive)
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Opciones de cotización y detalles financieros guardados correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al guardar opciones detalladas para RFQ ${requisicion_id}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};


/**
 * @route POST /api/rfq/:id/enviar-a-aprobacion
 * @description Cambia el estado de un RFQ de 'COTIZANDO' a 'POR_APROBAR'.
 */
const enviarRfqAprobacion = async (req, res) => {
    // ... (El código de esta función no necesita cambios)
    const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE requisiciones SET status = 'POR_APROBAR' WHERE id = $1 AND (status = 'COTIZANDO' OR status = 'POR_APROBAR') RETURNING id, status`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'La requisición no se encontró o está en un estado no válido.' });
        res.status(200).json({ mensaje: `La RFQ ha sido enviada a aprobación.`, requisicion: result.rows[0] });
    } catch (error) {
        console.error(`Error al enviar a aprobación la RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * @route POST /api/rfq/:id/cancelar
 * @description Cambia el estado de un RFQ a 'CANCELADA'.
 */
const cancelarRfq = async (req, res) => {
    // ... (El código de esta función no necesita cambios)
    const { id } = req.params;
    try {
        const rfqActual = await pool.query(`SELECT status FROM requisiciones WHERE id = $1`, [id]);
        if (rfqActual.rowCount === 0) return res.status(404).json({ error: 'El RFQ no existe.' });
        const statusActual = rfqActual.rows[0].status;
        if (statusActual !== 'COTIZANDO') return res.status(409).json({ error: `No se puede cancelar. El RFQ ya está en estado '${statusActual}'.` });
        await pool.query(`UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1`, [id]);
        res.status(200).json({ mensaje: `El RFQ con ID ${id} ha sido cancelado.` });
    } catch (error) {
        console.error(`Error al cancelar RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// =================================================================================================
// SECCIÓN 4: ACCIONES DEL APROBADOR (Visto Bueno VB_RFQ)
// =================================================================================================

/**
 * @route POST /api/rfq/:id/rechazar
 * @description Devuelve un RFQ de 'POR_APROBAR' a 'COTIZANDO' para su corrección.
 */
const rechazarRfq = async (req, res) => {
    // ... (El código de esta función no necesita cambios)
    const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE requisiciones SET status = 'COTIZANDO' WHERE id = $1 AND status = 'POR_APROBAR' RETURNING id`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El RFQ no se encontró o ya no está en estado para ser rechazado.' });
        }
        res.status(200).json({ mensaje: 'El RFQ ha sido devuelto a cotización.' });
    } catch (error) {
        console.error(`Error al rechazar RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Validar y bloquear el RFQ para evitar procesamientos duplicados.
        const rfqQuery = await client.query(`SELECT r.*, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'POR_APROBAR' FOR UPDATE`, [rfqId]);
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        const rfqData = rfqQuery.rows[0];

        // 2. Encontrar las opciones "ganadoras" seleccionadas por el comprador.
        const opcionesQuery = await client.query(`SELECT ro.*, p.marca as proveedor_marca, p.razon_social as proveedor_razon_social, p.correo as proveedor_correo FROM requisiciones_opciones ro JOIN proveedores p ON ro.proveedor_id = p.id WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE`, [rfqId]);
        if (opcionesQuery.rows.length === 0) throw new Error('No se encontraron opciones seleccionadas para generar OCs.');
        
        // 3. Agrupar por proveedor para crear una OC por cada uno.
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        // 4. Iterar sobre cada proveedor y procesar su OC.
        for (const proveedorId in comprasPorProveedor) {
            const items = comprasPorProveedor[proveedorId];
            const primerItem = items[0];

            // --- a. Crear la cabecera de la OC ---
            const ocInsertResult = await client.query(
                `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id) 
                 VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'APROBADA', $10) RETURNING id`,
                [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, primerItem.subtotal, primerItem.iva, primerItem.total, items.some(i => i.es_importacion), proveedorId]
            );
            const nuevaOcId = ocInsertResult.rows[0].id;

            // --- b. Crear el detalle de la OC y "congelar" los materiales ---
            for (const item of items) {
                await client.query(
                    `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega) 
                     VALUES ($1, $2, $3, (SELECT material_id FROM requisiciones_detalle WHERE id=$2), $4, $5, $6, $7)`,
                    [nuevaOcId, item.requisicion_detalle_id, item.id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null]
                );
                await client.query(`UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`, [nuevaOcId, item.requisicion_detalle_id]);
            }

            // --- c. RECOLECTAR TODOS LOS DATOS PARA EL PDF DENTRO DE LA TRANSACCIÓN ---
            const ocDataParaPdf = (await client.query(`SELECT oc.*, p.razon_social AS proveedor_razon_social, p.rfc AS proveedor_rfc, proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre as usuario_nombre, (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda, NOW() as fecha_aprobacion FROM ordenes_compra oc JOIN proveedores p ON oc.proveedor_id = p.id JOIN proyectos proy ON oc.proyecto_id = proy.id JOIN sitios s ON oc.sitio_id = s.id JOIN usuarios u ON oc.usuario_id = u.id WHERE oc.id = $1;`, [nuevaOcId])).rows[0];
            const itemsDataParaPdf = (await client.query(`SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo FROM ordenes_compra_detalle ocd JOIN catalogo_materiales cm ON ocd.material_id = cm.id JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id WHERE ocd.orden_compra_id = $1;`, [nuevaOcId])).rows;
            
            // --- d. Llamar al servicio de PDF pasándole los datos listos ---
            const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, itemsDataParaPdf);

            // --- e. Distribuir el archivo ---
            const fileName = `OC-${ocDataParaPdf.numero_oc}_${primerItem.proveedor_marca}.pdf`;
            const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, rfqData.depto_codigo, rfqData.rfq_code);
            const recipients = ['compras.biogas@gmail.com', primerItem.proveedor_correo].filter(Boolean);
            const subject = `Orden de Compra Aprobada: ${ocDataParaPdf.numero_oc}`;
            const htmlBody = `<p>Se ha generado una nueva Orden de Compra. El documento PDF se encuentra adjunto.</p><p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>`;
            await sendRequisitionEmail(recipients, subject, htmlBody, pdfBuffer, fileName);
            
            ocsGeneradasInfo.push(ocDataParaPdf.numero_oc);
        }

        // 5. Actualizar el estado final del RFQ.
        await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
        
        await client.query('COMMIT');
        res.status(200).json({ mensaje: `Proceso completado. OCs generadas y enviadas: ${ocsGeneradasInfo.join(', ')}.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al generar OCs para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};
module.exports = {
  getRequisicionesCotizando,
  getRfqDetalle,
  guardarOpcionesRfq,
  enviarRfqAprobacion,
  cancelarRfq,
  getRfqsPorAprobar,
  rechazarRfq,
  generarOcsDesdeRfq, // Reemplazamos la función antigua
  //aprobarRfqYGenerarOC,
};