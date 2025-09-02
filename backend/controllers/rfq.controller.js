// C:/SIRA/backend/controllers/rfq.controller.js
// C:/SIRA/backend/controllers/rfq.controller.js

const pool = require('../db/pool');

/**
 * Obtiene todas las requisiciones con estatus 'COTIZANDO'.
 */
const getRequisicionesCotizando = async (req, res) => {
  try {
    const query = `
      SELECT
        r.id,
        r.rfq_code,
        r.fecha_creacion,
        u.nombre AS usuario_creador,
        p.nombre AS proyecto,
        s.nombre AS sitio,
        r.lugar_entrega
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.status = 'COTIZANDO'
      ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones en cotización:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Obtiene el detalle completo de un RFQ, incluyendo materiales, opciones y adjuntos.
 */
const getRfqDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener datos de la cabecera
        const reqResult = await pool.query(`
            SELECT r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            WHERE r.id = $1;
        `, [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Requisición no encontrada.' });

        // 2. Obtener materiales
        const materialesResult = await pool.query(`
            SELECT rd.id, rd.cantidad, rd.comentario, cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
        `, [id]);

        // 3. Obtener opciones de cotización
        const opcionesResult = await pool.query(`
            SELECT ro.id, ro.requisicion_detalle_id, ro.proveedor_id, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social, ro.precio_unitario, ro.cantidad_cotizada, ro.moneda, ro.plazo_entrega, ro.condiciones_pago, ro.comentario, ro.seleccionado, ro.es_precio_neto, ro.es_importacion, ro.es_entrega_inmediata, ro.tiempo_entrega
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `, [id]);

        // 4. Obtener archivos adjuntos
        const adjuntosResult = await pool.query(
            `SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        // 5. Ensamblar la respuesta completa
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

/**
 * Guarda o actualiza las opciones de cotización para un RFQ.
 */
const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    const { opciones } = req.body;
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
        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Opciones de cotización guardadas correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al guardar opciones para RFQ ${requisicion_id}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

/**
 * Cambia el estado de un RFQ a 'POR_APROBAR'.
 */
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

/**
 * Rechaza un RFQ (lo devuelve a 'COTIZANDO').
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
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * Aprueba un RFQ, genera Órdenes de Compra y cambia el estado de la requisición.
 */
const aprobarRfqYGenerarOC = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validar RFQ
        const reqInfoQuery = await client.query(`SELECT usuario_id, sitio_id, proyecto_id, lugar_entrega FROM requisiciones WHERE id = $1 AND status = 'POR_APROBAR'`, [rfqId]);
        if (reqInfoQuery.rowCount === 0) {
            throw new Error('El RFQ no existe o no está en estado para ser aprobado.');
        }
        const reqInfo = reqInfoQuery.rows[0];

        // 2. Obtener Opciones Seleccionadas
        const opcionesQuery = await client.query(`
            SELECT ro.*, rd.material_id
            FROM requisiciones_opciones ro
            JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id
            WHERE ro.requisicion_id = $1 AND ro.seleccionado = TRUE AND ro.cantidad_cotizada > 0
        `, [rfqId]);
        const opcionesSeleccionadas = opcionesQuery.rows;

        if (opcionesSeleccionadas.length === 0) {
            throw new Error('No hay opciones de proveedor seleccionadas para este RFQ.');
        }

        // 3. Agrupar por Proveedor
        const comprasPorProveedor = {};
        for (const opt of opcionesSeleccionadas) {
            if (!comprasPorProveedor[opt.proveedor_id]) {
                comprasPorProveedor[opt.proveedor_id] = [];
            }
            comprasPorProveedor[opt.proveedor_id].push(opt);
        }

        // 4. Crear una OC por cada Proveedor
        for (const proveedorId in comprasPorProveedor) {
            const items = comprasPorProveedor[proveedorId];
            
            let subTotal = 0;
            items.forEach(item => {
                subTotal += (Number(item.cantidad_cotizada) * Number(item.precio_unitario));
            });
            const iva = subTotal * 0.16;
            const total = subTotal + iva;

            const ocInsertResult = await client.query(
                `INSERT INTO ordenes_compra (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total)
                 VALUES ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
                [usuarioId, rfqId, reqInfo.sitio_id, reqInfo.proyecto_id, reqInfo.lugar_entrega, subTotal, iva, total]
            );
            const ordenCompraId = ocInsertResult.rows[0].id;

            for (const item of items) {
                await client.query(
                    `INSERT INTO ordenes_compra_detalle (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [ordenCompraId, item.requisicion_detalle_id, item.id, item.material_id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.plazo_entrega]
                );
            }
        }

        // 5. Actualizar estado de la Requisición
        await client.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);

        // 6. Finalizar transacción
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

/**
 * Cancela un RFQ (lo cambia a 'CANCELADA').
 */
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