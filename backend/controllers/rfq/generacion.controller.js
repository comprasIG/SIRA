// C:\SIRA\backend\controllers\rfq\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación y Gestión de Cotizaciones (G-RFQ)
 * VERSIÓN REFACTORIZADA: 3.0 (Con carpetas de Drive anidadas)
 * -------------------------------------------------------------------------------------------------
 * FIX (VB_RFQ): Permitir actualizar proveedor_id al editar una opción existente.
 *   - Antes: El UPDATE de requisiciones_opciones no incluía proveedor_id (solo se insertaba en INSERT).
 *   - Ahora: El UPDATE incluye proveedor_id, conservando el resto de comportamiento.
 * =================================================================================================
 */
const pool = require('../../db/pool');
// --- Importar funciones de Drive ---
const { uploadQuoteToReqFolder, deleteFile } = require('../../services/googleDrive');

/**
 * GET /api/rfq/pendientes
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
 * GET /api/rfq/:id
 */
const getRfqDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const reqResult = await pool.query(`
            SELECT r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida,
                   r.lugar_entrega, le.nombre AS lugar_entrega_nombre, r.status,
                   r.comentario AS comentario_general, u.nombre AS usuario_creador,
                   p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            LEFT JOIN sitios le ON r.lugar_entrega::integer = le.id
            WHERE r.id = $1;
        `, [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Requisición no encontrada.' });

        const materialesResult = await pool.query(`
            SELECT rd.id, rd.cantidad, rd.comentario, rd.status_compra,
                   cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
        `, [id]);

        const opcionesResult = await pool.query(`
            SELECT ro.*, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `, [id]);

        const opcionesBloqueadasResult = await pool.query(
            `SELECT ocd.comparativa_precio_id
             FROM ordenes_compra_detalle ocd
             JOIN ordenes_compra oc ON ocd.orden_compra_id = oc.id
             WHERE oc.rfq_id = $1`,
            [id]
        );
        const opcionesBloqueadas = opcionesBloqueadasResult.rows.map(r => r.comparativa_precio_id);

        const adjuntosCotizacionResult = await pool.query(
            `SELECT id, proveedor_id, nombre_archivo, ruta_archivo FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        const proveedoresConOcResult = await pool.query(
            `SELECT DISTINCT proveedor_id FROM ordenes_compra WHERE rfq_id = $1`,
            [id]
        );
        const proveedoresConOc = proveedoresConOcResult.rows.map(r => r.proveedor_id);

        const adjuntosOriginalesResult = await pool.query(
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
            adjuntos_cotizacion: adjuntosCotizacionResult.rows,
            proveedores_con_oc: proveedoresConOc,
            opciones_bloqueadas: opcionesBloqueadas,
            adjuntos: adjuntosOriginalesResult.rows
        });
    } catch (error) {
        console.error(`Error al obtener detalle de RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/rfq/:id/opciones
 * (Guardado de cotizaciones)
 */
const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    let { opciones, resumenes, rfq_code, archivos_existentes_por_proveedor } = req.body;
    const files = req.files;

    try {
        opciones = JSON.parse(opciones);
        resumenes = JSON.parse(resumenes);
        archivos_existentes_por_proveedor = JSON.parse(archivos_existentes_por_proveedor);
    } catch {
        return res.status(400).json({ error: "El formato de 'opciones', 'resumenes' o 'archivos_existentes_por_proveedor' no es un JSON válido." });
    }

    const resumenMap = new Map(resumenes.map(r => [r.proveedorId, r]));
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // =================================================================
        // Obtener datos de ruta para Drive
        // =================================================================
        const reqDataQuery = await client.query(
            `SELECT r.numero_requisicion, d.codigo as depto_codigo
             FROM requisiciones r
             JOIN departamentos d ON r.departamento_id = d.id
             WHERE r.id = $1`,
            [requisicion_id]
        );
        if (reqDataQuery.rowCount === 0) throw new Error('No se encuentran los datos de la requisición base.');
        const { numero_requisicion, depto_codigo } = reqDataQuery.rows[0];
        // =================================================================

        // --- Adjuntos: borrar los que ya no existen (BD + Drive) ---
        const adjuntosEnBdResult = await client.query(
            `SELECT id, ruta_archivo FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1`,
            [requisicion_id]
        );

        let idsAConservar = [];
        for (const provId in archivos_existentes_por_proveedor) {
            idsAConservar.push(...archivos_existentes_por_proveedor[provId].map(f => f.id));
        }

        const adjuntosParaBorrar = adjuntosEnBdResult.rows.filter(adj => !idsAConservar.includes(adj.id));

        if (adjuntosParaBorrar.length > 0) {
            const idsABorrarSql = adjuntosParaBorrar.map(adj => adj.id);
            await client.query(
                `DELETE FROM rfq_proveedor_adjuntos WHERE id = ANY($1::int[])`,
                [idsABorrarSql]
            );

            for (const adj of adjuntosParaBorrar) {
                try {
                    const fileId = adj.ruta_archivo.split('/view')[0].split('/').pop();
                    if (fileId) await deleteFile(fileId);
                } catch (driveError) {
                    console.error(`Error al borrar archivo ${adj.id} de Drive. El registro de BD se borró.`, driveError);
                }
            }
        }

        // --- Subir solo archivos NUEVOS ---
        if (files && files.length > 0) {
            const providerNameMap = new Map();
            opciones.forEach(opt => {
                if (opt.proveedor) {
                    const nombreCarpeta = opt.proveedor.razon_social || opt.proveedor.nombre || 'Proveedor_Desconocido';
                    providerNameMap.set(String(opt.proveedor.id), nombreCarpeta);
                }
            });

            for (const file of files) {
                const fieldParts = file.fieldname.split('-');
                if (fieldParts[0] === 'cotizacion' && fieldParts[1] === 'archivo') {
                    const proveedorId = fieldParts[2];
                    const providerName = providerNameMap.get(proveedorId) || 'ProveedorDesconocido';

                    const uploadedFile = await uploadQuoteToReqFolder(
                        file,
                        depto_codigo,
                        numero_requisicion,
                        providerName
                    );

                    await client.query(
                        `INSERT INTO rfq_proveedor_adjuntos (requisicion_id, proveedor_id, nombre_archivo, ruta_archivo)
                         VALUES ($1, $2, $3, $4)`,
                        [requisicion_id, proveedorId, uploadedFile.name, uploadedFile.webViewLink]
                    );
                }
            }
        }

        // =================================================================
        // BORRADO INTELIGENTE de Opciones (no borra las bloqueadas en OC)
        // =================================================================
        const pendientesResult = await client.query(
            `SELECT id FROM requisiciones_detalle WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`,
            [requisicion_id]
        );
        const idsPendientes = pendientesResult.rows.map(row => row.id);

        const opcionesBloqueadasResult = await client.query(
            `SELECT ocd.comparativa_precio_id
             FROM ordenes_compra_detalle ocd
             JOIN ordenes_compra oc ON ocd.orden_compra_id = oc.id
             WHERE oc.rfq_id = $1`,
            [requisicion_id]
        );
        const opcionesBloqueadas = opcionesBloqueadasResult.rows.map(r => r.comparativa_precio_id);

        const opcionesActualesResult = await client.query(
            `SELECT id
             FROM requisiciones_opciones
             WHERE requisicion_id = $1 AND requisicion_detalle_id = ANY($2::int[])`,
            [requisicion_id, idsPendientes]
        );
        const opcionesActualesIds = opcionesActualesResult.rows.map(r => r.id);

        const idsAConservarOpciones = opciones
            .filter(opt => !!opt.id)
            .map(opt => opt.id);

        const idsParaBorrar = opcionesActualesIds.filter(id =>
            !idsAConservarOpciones.includes(id) &&
            !opcionesBloqueadas.includes(id)
        );

        if (idsParaBorrar.length > 0) {
            await client.query(
                `DELETE FROM requisiciones_opciones WHERE id = ANY($1::int[])`,
                [idsParaBorrar]
            );
        }

        // =================================================================
        // UPSERT de Opciones
        // =================================================================
        for (const opt of opciones) {
            // Solo procesa opciones con proveedor y que pertenezcan a una línea PENDIENTE
            if (!opt.proveedor_id || !idsPendientes.includes(opt.requisicion_detalle_id)) continue;

            const resumenProveedor = resumenMap.get(opt.proveedor_id);

            if (opt.id) {
                // UPDATE (solo si no está bloqueada por una OC)
                if (!opcionesBloqueadas.includes(opt.id)) {
                    // =====================================================================================
                    // FIX: incluir proveedor_id en el UPDATE para que VB_RFQ pueda cambiar proveedor.
                    // =====================================================================================
                    await client.query(
                        `UPDATE requisiciones_opciones
                         SET proveedor_id = $1,
                             precio_unitario = $2,
                             cantidad_cotizada = $3,
                             moneda = $4,
                             seleccionado = $5,
                             es_precio_neto = $6,
                             es_importacion = $7,
                             es_entrega_inmediata = $8,
                             tiempo_entrega = $9,
                             tiempo_entrega_valor = $10,
                             tiempo_entrega_unidad = $11,
                             subtotal = $12,
                             iva = $13,
                             ret_isr = $14,
                             total = $15,
                             config_calculo = $16,
                             es_total_forzado = $17
                         WHERE id = $18`,
                        [
                            opt.proveedor_id,
                            opt.precio_unitario,
                            opt.cantidad_cotizada,
                            opt.moneda || 'MXN',
                            opt.seleccionado,
                            opt.es_precio_neto,
                            opt.es_importacion,
                            opt.es_entrega_inmediata,
                            opt.tiempo_entrega,
                            opt.tiempo_entrega_valor || null,
                            opt.tiempo_entrega_unidad || null,
                            opt.seleccionado ? resumenProveedor?.subTotal : null,
                            opt.seleccionado ? resumenProveedor?.iva : null,
                            opt.seleccionado ? resumenProveedor?.retIsr : null,
                            opt.seleccionado ? resumenProveedor?.total : null,
                            opt.seleccionado ? resumenProveedor?.config : null,
                            opt.seleccionado ? resumenProveedor?.config?.isForcedTotalActive : false,
                            opt.id
                        ]
                    );
                }
            } else {
                // INSERT
                await client.query(
                    `INSERT INTO requisiciones_opciones
                    (requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada, moneda, seleccionado,
                     es_precio_neto, es_importacion, es_entrega_inmediata, tiempo_entrega, tiempo_entrega_valor, tiempo_entrega_unidad,
                     subtotal, iva, ret_isr, total, config_calculo, es_total_forzado)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
                    [
                        requisicion_id,
                        opt.requisicion_detalle_id,
                        opt.proveedor_id,
                        opt.precio_unitario,
                        opt.cantidad_cotizada,
                        opt.moneda || 'MXN',
                        opt.seleccionado,
                        opt.es_precio_neto,
                        opt.es_importacion,
                        opt.es_entrega_inmediata,
                        opt.tiempo_entrega || null,
                        opt.tiempo_entrega_valor || null,
                        opt.tiempo_entrega_unidad || null,
                        opt.seleccionado ? resumenProveedor?.subTotal : null,
                        opt.seleccionado ? resumenProveedor?.iva : null,
                        opt.seleccionado ? resumenProveedor?.retIsr : null,
                        opt.seleccionado ? resumenProveedor?.total : null,
                        opt.seleccionado ? resumenProveedor?.config : null,
                        opt.seleccionado ? resumenProveedor?.config?.isForcedTotalActive : false
                    ]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Opciones y archivos de cotización guardados correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al guardar opciones detalladas para RFQ ${requisicion_id}:`, error);
        res.status(500).json({ error: error.message || "Error interno del servidor." });
    } finally {
        client.release();
    }
};

/**
 * POST /api/rfq/:id/enviar-a-aprobacion
 */
const enviarRfqAprobacion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'POR_APROBAR'
             WHERE id = $1 AND (status = 'COTIZANDO' OR status = 'POR_APROBAR')
             RETURNING id, status`,
            [id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'La requisición no se encontró o está en un estado no válido.' });
        res.status(200).json({ mensaje: `La RFQ ha sido enviada a aprobación.`, requisicion: result.rows[0] });
    } catch (error) {
        console.error(`Error al enviar a aprobación la RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * POST /api/rfq/:id/cancelar
 */
const cancelarRfq = async (req, res) => {
    const { id } = req.params;
    try {
        const rfqActual = await pool.query(`SELECT status FROM requisiciones WHERE id = $1`, [id]);
        if (rfqActual.rowCount === 0) return res.status(404).json({ error: 'El RFQ no existe.' });

        const statusActual = rfqActual.rows[0].status;
        if (statusActual !== 'COTIZANDO') {
            return res.status(409).json({ error: `No se puede cancelar. El RFQ ya está en estado '${statusActual}'.` });
        }

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
};
