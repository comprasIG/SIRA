// C:/SIRA/backend/controllers/rfq.controller.js
/**
 * Controlador para toda la lógica de negocio relacionada con
 * las Solicitudes de Cotización (RFQs), desde su creación hasta la
 * generación de Órdenes de Compra.
 */
const pool = require('../db/pool');
const { uploadQuoteFiles } = require('../services/googleDrive');

// =================================================================================================
// OBTENER LISTAS DE RFQs
// =================================================================================================

/**
 * Obtiene todas las requisiciones con estatus 'COTIZANDO'.
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
 * Obtiene la lista de RFQs pendientes de Visto Bueno ('POR_APROBAR').
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

// =================================================================================================
// OBTENER DETALLE DE UN RFQ
// =================================================================================================

const getRfqDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const reqResult = await pool.query(`
            SELECT r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            WHERE r.id = $1;
        `, [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Requisición no encontrada.' });

        const materialesResult = await pool.query(`
            SELECT rd.id, rd.cantidad, rd.comentario, cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
        `, [id]);

        const opcionesResult = await pool.query(`
            SELECT ro.id, ro.requisicion_detalle_id, ro.proveedor_id, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social, ro.precio_unitario, ro.cantidad_cotizada, ro.moneda, ro.plazo_entrega, ro.condiciones_pago, ro.comentario, ro.seleccionado, ro.es_precio_neto, ro.es_importacion, ro.es_entrega_inmediata, ro.tiempo_entrega
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `, [id]);
        
        const adjuntosResult = await pool.query(
            `SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        const materialesConOpciones = materialesResult.rows.map(material => ({
            ...material,
            opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id)
        }));
        
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
// ACCIONES DEL COMPRADOR (G_RFQ)
// =================================================================================================

/**
 * Guarda o actualiza las opciones de cotización, incluyendo archivos.
 * NOTA: Esta función no requiere cambios, ya que 'es_importacion' ya se guarda
 * correctamente en la tabla 'requisiciones_opciones'.
 */
const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    let { opciones, rfq_code } = req.body;
    
    try {
        opciones = JSON.parse(opciones);
    } catch {
        return res.status(400).json({ error: "El formato de las opciones no es un JSON válido." });
    }

    if (!Array.isArray(opciones)) return res.status(400).json({ error: "Se requiere un array de opciones." });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query(`DELETE FROM requisiciones_opciones WHERE requisicion_id = $1`, [requisicion_id]);
        
        for (const opt of opciones) {
             if (!opt.proveedor_id) continue;
             await client.query(
                `INSERT INTO requisiciones_opciones (requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada, moneda, plazo_entrega, condiciones_pago, comentario, seleccionado, es_precio_neto, es_importacion, es_entrega_inmediata, tiempo_entrega) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [requisicion_id, opt.requisicion_detalle_id, opt.proveedor_id, opt.precio_unitario, opt.cantidad_cotizada, opt.moneda || 'MXN', opt.plazo_entrega, opt.condiciones_pago, opt.comentario, opt.seleccionado, opt.es_precio_neto, opt.es_importacion, opt.es_entrega_inmediata, opt.tiempo_entrega]
            );
        }

        if (req.files && req.files.length > 0) {
            const filesByProvider = req.files.reduce((acc, file) => {
                const providerId = file.fieldname.split('-')[1];
                if (!acc[providerId]) acc[providerId] = [];
                acc[providerId].push(file);
                return acc;
            }, {});

            for (const providerId in filesByProvider) {
                const providerFiles = filesByProvider[providerId];
                const proveedorResult = await client.query('SELECT marca FROM proveedores WHERE id = $1', [providerId]);
                const providerName = proveedorResult.rows[0]?.marca || `prov${providerId}`;
                const uploadedFiles = await uploadQuoteFiles(providerFiles, rfq_code, providerName);

                for (const uploadedFile of uploadedFiles) {
                    await client.query(
                        'INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)',
                        [requisicion_id, uploadedFile.originalName, uploadedFile.webViewLink]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Opciones de cotización y archivos guardados correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al guardar opciones para RFQ ${requisicion_id}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const enviarRfqAprobacion = async (req, res) => {
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

const cancelarRfq = async (req, res) => {
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
// ACCIONES DEL APROBADOR (VB_RFQ)
// =================================================================================================

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
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const aprobarRfqYGenerarOC = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const reqInfoQuery = await client.query(`SELECT usuario_id, sitio_id, proyecto_id, lugar_entrega FROM requisiciones WHERE id = $1 AND status = 'POR_APROBAR'`, [rfqId]);
        if (reqInfoQuery.rowCount === 0) throw new Error('El RFQ no existe o no está en estado para ser aprobado.');
        const reqInfo = reqInfoQuery.rows[0];

        // Se leen las opciones, incluyendo el campo 'es_importacion'
        const opcionesQuery = await client.query(`SELECT ro.*, rd.material_id FROM requisiciones_opciones ro JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE AND ro.cantidad_cotizada > 0`, [rfqId]);
        if (opcionesQuery.rows.length === 0) throw new Error('No hay opciones de proveedor seleccionadas para este RFQ.');
        
        const comprasPorProveedor = opcionesQuery.rows.reduce((acc, opt) => {
            if (!acc[opt.proveedor_id]) acc[opt.proveedor_id] = [];
            acc[opt.proveedor_id].push(opt);
            return acc;
        }, {});

        for (const proveedorId in comprasPorProveedor) {
            const items = comprasPorProveedor[proveedorId];
            let subTotal = items.reduce((sum, item) => sum + (Number(item.cantidad_cotizada) * Number(item.precio_unitario)), 0);
            const iva = subTotal * 0.16; // Este cálculo podría ser más complejo en el futuro
            const total = subTotal + iva;
            
            // ------------------------------------------------------------------
            // CAMBIO 1/3: Determinar si la orden de compra completa es de importación.
            // Si al menos UN item de este proveedor está marcado, toda la OC lo estará.
            const esOrdenDeImportacion = items.some(item => item.es_importacion === true);
            // ------------------------------------------------------------------

            // CAMBIO 2/3: Se añade la nueva columna 'impo' al INSERT.
            const ocInsertResult = await client.query(
                `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo) VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                // CAMBIO 3/3: Se pasa el nuevo valor 'esOrdenDeImportacion' a la consulta.
                [usuarioId, rfqId, reqInfo.sitio_id, reqInfo.proyecto_id, reqInfo.lugar_entrega, subTotal, iva, total, esOrdenDeImportacion]
            );
            const ordenCompraId = ocInsertResult.rows[0].id;

            for (const item of items) {
                await client.query(
                    `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [ordenCompraId, item.requisicion_detalle_id, item.id, item.material_id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.plazo_entrega]
                );
            }
        }

        await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
        await client.query('COMMIT');
        res.status(200).json({ mensaje: `RFQ aprobado y ${Object.keys(comprasPorProveedor).length} Órdenes de Compra generadas.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al aprobar RFQ y generar OC para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// =================================================================================================
// EXPORTACIONES
// =================================================================================================
module.exports = {
  getRequisicionesCotizando,
  getRfqDetalle,
  guardarOpcionesRfq,
  enviarRfqAprobacion,
  cancelarRfq,
  getRfqsPorAprobar,
  rechazarRfq,
  aprobarRfqYGenerarOC,
};