// C:\SIRA\backend\controllers\finanzas\autorizacionOC.controller.js

const pool = require('../../db/pool');

/**
 * =================================================================================
 * AUTORIZAR OC A CRÉDITO
 * =================================================================================
 * 1. Valida que la OC exista y esté en 'POR_AUTORIZAR'.
 * 2. Calcula la fecha de vencimiento (usando días de crédito del proveedor o 30 por defecto).
 * 3. Actualiza la OC: status -> 'APROBADA', metodo_pago -> 'CREDITO', y fecha_vencimiento.
 * 4. Inserta un registro en la tabla de historial para trazabilidad.
 * 5. TODO (en un futuro): Disparar notificaciones y otros procesos post-aprobación.
 */
const aprobarCredito = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    const { id: usuarioId } = req.usuarioSira; // Obtenido del token de autenticación
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Obtener OC y datos del proveedor para el cálculo
        const ocQuery = await client.query(
            `SELECT oc.*, p.dias_credito 
             FROM ordenes_compra oc
             JOIN proveedores p ON oc.proveedor_id = p.id
             WHERE oc.id = $1 FOR UPDATE`,
            [ordenCompraId]
        );

        if (ocQuery.rowCount === 0) {
            return res.status(404).json({ error: 'Orden de Compra no encontrada.' });
        }

        const ocData = ocQuery.rows[0];

        if (ocData.status !== 'POR_AUTORIZAR') {
            return res.status(409).json({ error: `La OC ya se encuentra en estado '${ocData.status}' y no puede ser modificada.` });
        }

        // 2. Calcular fecha de vencimiento
        const diasCredito = ocData.dias_credito || 30; // Usar 30 días si no está definido
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);

        // 3. Actualizar la Orden de Compra
        const updateQuery = await client.query(
            `UPDATE ordenes_compra
             SET 
                status = 'APROBADA',
                metodo_pago = 'CREDITO',
                fecha_vencimiento_pago = $1
             WHERE id = $2
             RETURNING id, status, fecha_vencimiento_pago`,
            [fechaVencimiento, ordenCompraId]
        );

        // 4. Insertar registro en el historial (Audit Log)
        const detallesHistorial = {
            cambios: [
                { campo: 'status', anterior: 'POR_AUTORIZAR', nuevo: 'APROBADA' },
                { campo: 'metodo_pago', anterior: null, nuevo: 'CREDITO' },
                { campo: 'fecha_vencimiento_pago', anterior: null, nuevo: fechaVencimiento.toISOString().split('T')[0] }
            ],
            calculo_dias_credito: diasCredito
        };

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, $3, $4)`,
            [ordenCompraId, usuarioId, 'APROBACIÓN A CRÉDITO', JSON.stringify(detallesHistorial)]
        );

        await client.query('COMMIT');

        res.status(200).json({
            mensaje: 'Orden de Compra aprobada a crédito exitosamente.',
            ordenCompra: updateQuery.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al aprobar OC a crédito:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

module.exports = {
    aprobarCredito,
};