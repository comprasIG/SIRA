// C:\SIRA\backend\controllers\finanzas\autorizacionOC.controller.js

const pool = require('../../db/pool');
const { uploadPdfBuffer } = require('../../services/googleDrive');

const getOcsPorAutorizar = async (req, res) => {
    try {
        const queryResult = await pool.query(
            `SELECT 
                oc.id,
                oc.numero_oc,
                oc.total,
                oc.fecha_creacion,
                p.razon_social AS proveedor_razon_social,
                pr.nombre AS proyecto_nombre
             FROM ordenes_compra oc
             JOIN proveedores p ON oc.proveedor_id = p.id
             JOIN proyectos pr ON oc.proyecto_id = pr.id
             WHERE oc.status = 'POR_AUTORIZAR'
             ORDER BY oc.fecha_creacion ASC`
        );

        res.status(200).json(queryResult.rows);

    } catch (error) {
        console.error('Error al obtener OCs por autorizar:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * =================================================================================
 * PRE-AUTORIZAR OC para PAGO con SPEI
 * =================================================================================
 * 1. Valida que la OC exista y esté en 'POR_AUTORIZAR'.
 * 2. Actualiza la OC: status -> 'CONFIRMAR_SPEI', metodo_pago -> 'SPEI'.
 * 3. Inserta un registro en el historial para trazabilidad.
 */
const preautorizarSpei = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Validar que la OC esté en el estado correcto
        const ocQuery = await client.query(
            `SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`,
            [ordenCompraId]
        );

        if (ocQuery.rowCount === 0) {
            return res.status(404).json({ error: 'Orden de Compra no encontrada.' });
        }
        
        const currentStatus = ocQuery.rows[0].status;
        if (currentStatus !== 'POR_AUTORIZAR') {
            return res.status(409).json({ error: `La OC ya se encuentra en estado '${currentStatus}' y no puede ser procesada.` });
        }

        // 2. Actualizar la OC al estado intermedio
        const updateResult = await client.query(
            `UPDATE ordenes_compra
             SET 
                status = 'CONFIRMAR_SPEI',
                metodo_pago = 'SPEI'
             WHERE id = $1
             RETURNING id, status, metodo_pago`,
            [ordenCompraId]
        );

        // 3. Registrar la acción en el historial
        const detallesHistorial = {
            cambios: [
                { campo: 'status', anterior: 'POR_AUTORIZAR', nuevo: 'CONFIRMAR_SPEI' },
                { campo: 'metodo_pago', anterior: null, nuevo: 'SPEI' }
            ]
        };

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, $3, $4)`,
            [ordenCompraId, usuarioId, 'PRE-AUTORIZACIÓN SPEI', JSON.stringify(detallesHistorial)]
        );

        await client.query('COMMIT');

        res.status(200).json({
            mensaje: 'OC pre-autorizada para pago con SPEI. Pendiente de comprobante.',
            ordenCompra: updateResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al pre-autorizar OC para SPEI:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

/**
 * =================================================================================
 * CONFIRMAR PAGO SPEI CON COMPROBANTE
 * =================================================================================
 * 1. Valida que la OC esté en 'CONFIRMAR_SPEI'.
 * 2. Valida que se haya enviado un archivo.
 * 3. Sube el archivo a Google Drive.
 * 4. Actualiza la OC: status -> 'APROBADA', y guarda el link del comprobante.
 * 5. Registra la aprobación final en el historial.
 */
const confirmarSpeiConComprobante = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { montoPagado } = req.body; // El frontend puede enviar un monto específico
    const archivoComprobante = req.file;
    const client = await pool.connect();

    try {
        // 1. Validar que se envió un archivo
        if (!archivoComprobante) {
            return res.status(400).json({ error: 'No se proporcionó el archivo del comprobante.' });
        }

        await client.query('BEGIN');

        // 2. Validar estado de la OC
        const ocQuery = await client.query(
            `SELECT numero_oc, status, total FROM ordenes_compra WHERE id = $1 FOR UPDATE`,
            [ordenCompraId]
        );

        if (ocQuery.rowCount === 0) {
            return res.status(404).json({ error: 'Orden de Compra no encontrada.' });
        }
        
        const ocData = ocQuery.rows[0];
        if (ocData.status !== 'CONFIRMAR_SPEI') {
            return res.status(409).json({ error: `La OC está en estado '${ocData.status}' y no puede ser confirmada.` });
        }

        // 3. Subir el archivo a Google Drive
        // Usamos una lógica similar a la que ya tienes para subir PDFs de OCs.
        const nombreArchivo = `COMPROBANTE_${ocData.numero_oc}_${Date.now()}`;
        const carpetaRaiz = 'COMPROBANTES_DE_PAGO'; // Carpeta principal en Drive
        const subCarpeta = ocData.numero_oc; // Sub-carpeta por OC
        
        const driveFile = await uploadPdfBuffer(
            archivoComprobante.buffer,
            nombreArchivo,
            carpetaRaiz,
            subCarpeta
        );

        if (!driveFile || !driveFile.webViewLink) {
            throw new Error('Falló la subida del comprobante a Google Drive.');
        }

        // 4. Actualizar la OC a 'APROBADA'
        const montoFinalPagado = montoPagado || ocData.total; // Usa el total si no se especifica un monto
        
        const updateResult = await client.query(
            `UPDATE ordenes_compra
             SET 
                status = 'APROBADA',
                comprobante_pago_link = $1,
                monto_pagado = $2
             WHERE id = $3
             RETURNING id, status`,
            [driveFile.webViewLink, montoFinalPagado, ordenCompraId]
        );

        // 5. Registrar la confirmación en el historial
        const detallesHistorial = {
            cambios: [
                { campo: 'status', anterior: 'CONFIRMAR_SPEI', nuevo: 'APROBADA' }
            ],
            comprobante: driveFile.webViewLink,
            monto: montoFinalPagado
        };

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, $3, $4)`,
            [ordenCompraId, usuarioId, 'CONFIRMACIÓN PAGO SPEI', JSON.stringify(detallesHistorial)]
        );

        await client.query('COMMIT');

        res.status(200).json({
            mensaje: 'Pago confirmado y Orden de Compra APROBADA.',
            ordenCompra: updateResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al confirmar pago SPEI:', error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

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

/**
 * =================================================================================
 * OBTENER DETALLES DE CRÉDITO PARA UNA OC
 * =================================================================================
 */
const getDetallesCredito = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    try {
        const result = await pool.query(
            `SELECT p.dias_credito
             FROM ordenes_compra oc
             JOIN proveedores p ON oc.proveedor_id = p.id
             WHERE oc.id = $1`,
            [ordenCompraId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'OC no encontrada.' });
        }

        res.status(200).json(result.rows[0]);

    } catch (error){
        console.error('Error al obtener detalles de crédito:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


module.exports = {
    getOcsPorAutorizar, 
    aprobarCredito,
    preautorizarSpei, 
    confirmarSpeiConComprobante,
    getDetallesCredito,
};