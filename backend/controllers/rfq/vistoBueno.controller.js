//C:\SIRA\backend\controllers\rfq\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Visto Bueno de Cotizaciones (VB_RFQ) - Versión Final
 * =================================================================================================
 */
const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
const { uploadPdfBuffer } = require('../../services/googleDrive');
const { sendRequisitionEmail } = require('../../services/emailService');

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

const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { proveedorId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const rfqQuery = await client.query(`SELECT r.*, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'POR_APROBAR' FOR UPDATE`, [rfqId]);
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        const rfqData = rfqQuery.rows[0];

        let opcionesQueryString = `SELECT ro.*, p.marca as proveedor_marca, p.razon_social as proveedor_razon_social, p.correo as proveedor_correo FROM requisiciones_opciones ro JOIN proveedores p ON ro.proveedor_id = p.id WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE`;
        const queryParams = [rfqId];
        if (proveedorId) {
            opcionesQueryString += ` AND ro.proveedor_id = $2`;
            queryParams.push(proveedorId);
        }
        const opcionesQuery = await client.query(opcionesQueryString, queryParams);
        if (opcionesQuery.rows.length === 0) throw new Error('No se encontraron opciones seleccionadas para generar OCs.');
        
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            (acc[opt.proveedor_id] = acc[opt.proveedor_id] || []).push(opt);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        for (const provId in comprasPorProveedor) {
            const items = comprasPorProveedor[provId];
            const primerItem = items[0];

            const ocInsertResult = await client.query(`INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id) VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10) RETURNING id`, [usuarioId, rfqId, rfqData.sitio_id, rfqData.proyecto_id, rfqData.lugar_entrega, primerItem.subtotal, primerItem.iva, primerItem.total, items.some(i => i.es_importacion), provId]);
            const nuevaOcId = ocInsertResult.rows[0].id;

            for (const item of items) {
                await client.query(`INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega) VALUES ($1, $2, $3, (SELECT material_id FROM requisiciones_detalle WHERE id=$2), $4, $5, $6, $7)`, [nuevaOcId, item.requisicion_detalle_id, item.id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.tiempo_entrega_valor ? `${item.tiempo_entrega_valor} ${item.tiempo_entrega_unidad}` : null]);
                await client.query(`UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`, [nuevaOcId, item.requisicion_detalle_id]);
            }

            const ocDataParaPdfResult = await client.query(`SELECT oc.*, p.razon_social AS proveedor_razon_social, p.rfc AS proveedor_rfc, proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre as usuario_nombre, (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) as moneda, NOW() as fecha_aprobacion FROM ordenes_compra oc JOIN proveedores p ON oc.proveedor_id = p.id JOIN proyectos proy ON oc.proyecto_id = proy.id JOIN sitios s ON oc.sitio_id = s.id JOIN usuarios u ON oc.usuario_id = u.id WHERE oc.id = $1;`, [nuevaOcId]);
            const ocDataParaPdf = ocDataParaPdfResult.rows[0];
            
            const itemsDataParaPdfResult = await client.query(`SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo FROM ordenes_compra_detalle ocd JOIN catalogo_materiales cm ON ocd.material_id = cm.id JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id WHERE ocd.orden_compra_id = $1;`, [nuevaOcId]);
            const itemsDataParaPdf = itemsDataParaPdfResult.rows;
            
            const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, itemsDataParaPdf);
            const fileName = `OC-${ocDataParaPdf.numero_oc}_${primerItem.proveedor_marca}.pdf`;
            const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, 'ORDENES DE COMPRA (PDF)', ocDataParaPdf.numero_oc);
            
            const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
            if (recipients.length > 0) {
                const subject = `OC Generada para Autorización: ${ocDataParaPdf.numero_oc} (${primerItem.proveedor_razon_social})`;
                const htmlBody = `<p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p><p>El documento PDF se encuentra adjunto.</p><p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>`;
                await sendRequisitionEmail(recipients, subject, htmlBody, pdfBuffer, fileName);
            }
            
            ocsGeneradasInfo.push({
                numero_oc: ocDataParaPdf.numero_oc,
                id: nuevaOcId // <-- ¡IMPORTANTE! Añadimos el ID
            });
        }

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

module.exports = {
    getRfqsPorAprobar,
    rechazarRfq,
    generarOcsDesdeRfq,
};