// C:/SIRA/backend/controllers/rfq.controller.js

const pool = require('../db/pool');

// ... las funciones getRequisicionesCotizando y getRfqDetalle se mantienen igual ...

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

const getRfqDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const reqQuery = `
            SELECT
                r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida,
                r.lugar_entrega, r.status, r.comentario AS comentario_general,
                u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            WHERE r.id = $1;
        `;
        const reqResult = await pool.query(reqQuery, [id]);
        if (reqResult.rows.length === 0) {
            return res.status(404).json({ error: 'Requisición no encontrada.' });
        }

        const materialesQuery = `
            SELECT
                rd.id, rd.cantidad, rd.comentario,
                cm.id as material_id,
                cm.nombre AS material,
                cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1
            ORDER BY cm.nombre;
        `;
        const materialesResult = await pool.query(materialesQuery, [id]);

        const opcionesQuery = `
            SELECT
                ro.id,
                ro.requisicion_detalle_id,
                ro.proveedor_id,
                p.marca as proveedor_nombre,
                p.razon_social as proveedor_razon_social,
                ro.precio_unitario,
                ro.cantidad_cotizada,
                ro.moneda,
                ro.plazo_entrega,
                ro.condiciones_pago,
                ro.comentario,
                ro.seleccionado,
                ro.es_precio_neto,
                ro.es_importacion,
                ro.es_entrega_inmediata,
                ro.tiempo_entrega
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `;
        const opcionesResult = await pool.query(opcionesQuery, [id]);

        const materialesConOpciones = materialesResult.rows.map(material => {
            return {
                ...material,
                opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id)
            };
        });

        const rfqCompleto = {
            ...reqResult.rows[0],
            materiales: materialesConOpciones
        };

        res.json(rfqCompleto);

    } catch (error) {
        console.error(`Error al obtener detalle de RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    const { opciones } = req.body;

    if (!Array.isArray(opciones)) {
        return res.status(400).json({ error: "Se requiere un array de opciones." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM requisiciones_opciones WHERE requisicion_id = $1`, [requisicion_id]);
        
        for (const opt of opciones) {
             if (!opt.proveedor_id) continue; // Omite opciones sin proveedor
             await client.query(
                `INSERT INTO requisiciones_opciones (
                    requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada,
                    moneda, plazo_entrega, condiciones_pago, comentario, seleccionado,
                    es_precio_neto, es_importacion, es_entrega_inmediata, tiempo_entrega
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    requisicion_id, opt.requisicion_detalle_id, opt.proveedor_id, opt.precio_unitario, opt.cantidad_cotizada,
                    opt.moneda || 'MXN', opt.plazo_entrega, opt.condiciones_pago, opt.comentario, opt.seleccionado,
                    opt.es_precio_neto, opt.es_importacion, opt.es_entrega_inmediata, opt.tiempo_entrega
                ]
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

const enviarRfqAprobacion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'POR_APROBAR' WHERE id = $1 AND (status = 'COTIZANDO' OR status = 'POR_APROBAR') RETURNING id, status`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'La requisición no se encontró o está en un estado no válido.' });
        }
        res.status(200).json({
            mensaje: `La RFQ ha sido enviada a aprobación.`,
            requisicion: result.rows[0]
        });
    } catch (error) {
        console.error(`Error al enviar a aprobación la RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * Cancela un RFQ, cambiando su estado a 'CANCELADA'.
 */
const cancelarRfq = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1 AND status = 'COTIZANDO' RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'El RFQ no existe o ya fue procesado.' });
    }
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
  cancelarRfq, // <-- Se añade la nueva función
};