// C:\SIRA\backend\controllers\rfq\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación y Gestión de Cotizaciones (G_RFQ)
 * =================================================================================================
 */
const pool = require('../../db/pool');
const { uploadQuoteFile, deleteFile } = require('../../services/googleDrive'); // Importar deleteFile

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

        // 1. Obtenemos los adjuntos de las cotizaciones.
        const adjuntosCotizacionResult = await pool.query(
            `SELECT id, proveedor_id, nombre_archivo, ruta_archivo FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        // 2. Obtenemos una lista de los IDs de proveedores que ya tienen una OC generada.
        const proveedoresConOcResult = await pool.query(
            `SELECT DISTINCT proveedor_id FROM ordenes_compra WHERE rfq_id = $1`,
            [id]
        );
        const proveedoresConOc = proveedoresConOcResult.rows.map(r => r.proveedor_id);
        
        const adjuntosOriginalesResult = await pool.query(`SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1`, [id]);
        
        const materialesConOpciones = materialesResult.rows.map(material => ({
            ...material,
            opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id)
        }));
        
        res.json({ 
            ...reqResult.rows[0], 
            materiales: materialesConOpciones,
            adjuntos_cotizacion: adjuntosCotizacionResult.rows, // <-- Campo existente
            proveedores_con_oc: proveedoresConOc,
            opciones_bloqueadas: opcionesBloqueadas,
            adjuntos: adjuntosOriginalesResult.rows
        });
    } catch (error) {
        console.error(`Error al obtener detalle de RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const guardarOpcionesRfq = async (req, res) => {
    const { id: requisicion_id } = req.params;
    let { opciones, resumenes, rfq_code, archivos_existentes_por_proveedor } = req.body;
    const files = req.files; 

    try {
        opciones = JSON.parse(opciones);
        resumenes = JSON.parse(resumenes);
        // CAMBIO: Parsear los archivos existentes
        archivos_existentes_por_proveedor = JSON.parse(archivos_existentes_por_proveedor);
    } catch {
        return res.status(400).json({ error: "El formato de 'opciones', 'resumenes' o 'archivos_existentes_por_proveedor' no es un JSON válido." });
    }
    
    const resumenMap = new Map(resumenes.map(r => [r.proveedorId, r]));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // ==================================================================
        // --- CAMBIO: Lógica de Adjuntos Inteligente ---
        // ==================================================================

        // 1. Obtener TODOS los adjuntos existentes en la BD para este RFQ
        const adjuntosEnBdResult = await client.query(
            `SELECT id, ruta_archivo FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1`,
            [requisicion_id]
        );

        // 2. Aplanar la lista de IDs que el frontend quiere conservar
        let idsAConservar = [];
        for (const provId in archivos_existentes_por_proveedor) {
            idsAConservar.push(...archivos_existentes_por_proveedor[provId].map(f => f.id));
        }

        // 3. Encontrar y borrar adjuntos que ya no se quieren
        const adjuntosParaBorrar = adjuntosEnBdResult.rows.filter(
            adj => !idsAConservar.includes(adj.id)
        );

        if (adjuntosParaBorrar.length > 0) {
            const idsABorrarSql = adjuntosParaBorrar.map(adj => adj.id);
            await client.query(
                `DELETE FROM rfq_proveedor_adjuntos WHERE id = ANY($1::int[])`,
                [idsABorrarSql]
            );
            // Opcional: Borrar de Google Drive (ignorar errores si falla)
            for (const adj of adjuntosParaBorrar) {
                try {
                    const fileId = adj.ruta_archivo.split('/view')[0].split('/').pop();
                    if (fileId) await deleteFile(fileId);
                } catch (driveError) {
                    console.error(`Error al borrar archivo ${adj.id} de Drive. El registro de BD se borró de todos modos.`, driveError);
                }
            }
        }

        // 4. Subir y guardar solo los archivos NUEVOS
        if (files && files.length > 0) {
            const providerNameMap = new Map();
            opciones.forEach(opt => {
                if (opt.proveedor) {
                    providerNameMap.set(String(opt.proveedor.id), opt.proveedor.razon_social || opt.proveedor.nombre);
                }
            });

            for (const file of files) {
                const fieldParts = file.fieldname.split('-');
                if (fieldParts[0] === 'cotizacion' && fieldParts[1] === 'archivo') {
                    const proveedorId = fieldParts[2];
                    const providerName = providerNameMap.get(proveedorId) || 'ProveedorDesconocido';
                    const uploadedFile = await uploadQuoteFile(file, rfq_code, providerName);
                    await client.query(
                        `INSERT INTO rfq_proveedor_adjuntos (requisicion_id, proveedor_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3, $4)`,
                        [requisicion_id, proveedorId, uploadedFile.name, uploadedFile.webViewLink]
                    );
                }
            }
        }
        // ==================================================================
        // --- FIN CAMBIO ADJUNTOS ---
        // ==================================================================

        // -----------------------------------------------------------------------------------
        // PASO 1: Identifica ids pendientes y opciones bloqueadas por OC (no se pueden borrar)
        // -----------------------------------------------------------------------------------
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

        // -----------------------------------------------------------------------------------
        // PASO 2: BORRADO INTELIGENTE (opciones no presentes y no bloqueadas)
        // -----------------------------------------------------------------------------------
        const opcionesActualesResult = await client.query(
            `SELECT id FROM requisiciones_opciones WHERE requisicion_id = $1 AND requisicion_detalle_id = ANY($2::int[])`,
            [requisicion_id, idsPendientes]
        );
        const opcionesActualesIds = opcionesActualesResult.rows.map(r => r.id);

        // CAMBIO: Usar 'id' (que viene de 'id_bd' en el front)
        const idsAConservarOpciones = opciones
            .filter(opt => !!opt.id)
            .map(opt => opt.id);

        const idsParaBorrar = opcionesActualesIds
            .filter(id =>
                !idsAConservarOpciones.includes(id) &&
                !opcionesBloqueadas.includes(id)
            );

        if (idsParaBorrar.length > 0) {
            await client.query(
                `DELETE FROM requisiciones_opciones WHERE id = ANY($1::int[])`,
                [idsParaBorrar]
            );
        }

        // -----------------------------------------------------------------------------------
        // PASO 3: INSERTA/ACTUALIZA opciones del payload (solo para líneas PENDIENTES)
        // -----------------------------------------------------------------------------------
        for (const opt of opciones) {
            if (!opt.proveedor_id || !idsPendientes.includes(opt.requisicion_detalle_id)) continue;
            
            const resumenProveedor = resumenMap.get(opt.proveedor_id);

            // CAMBIO: Usar 'id' (que viene de 'id_bd' en el front)
            if (opt.id) {
                // UPDATE si ya existe (opción editada, pero no bloqueada)
                if (!opcionesBloqueadas.includes(opt.id)) {
                    await client.query(
                        `UPDATE requisiciones_opciones 
                         SET precio_unitario = $1, cantidad_cotizada = $2, moneda = $3, seleccionado = $4, es_precio_neto = $5, es_importacion = $6, es_entrega_inmediata = $7, tiempo_entrega = $8, tiempo_entrega_valor = $9, tiempo_entrega_unidad = $10, subtotal = $11, iva = $12, ret_isr = $13, total = $14, config_calculo = $15, es_total_forzado = $16
                         WHERE id = $17`,
                        [
                            opt.precio_unitario, 
                            opt.cantidad_cotizada, 
                            opt.moneda || 'MXN',
                            opt.seleccionado,
                            opt.es_precio_neto,
                            opt.es_importacion,
                            opt.es_entrega_inmediata,
                            opt.tiempo_entrega, // <-- Asegurarse que esta columna exista (si no, quitarla)
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
                // INSERT si no existe
                await client.query(
                    `INSERT INTO requisiciones_opciones 
                    (requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada, moneda, seleccionado, es_precio_neto, es_importacion, es_entrega_inmediata, tiempo_entrega, tiempo_entrega_valor, tiempo_entrega_unidad, subtotal, iva, ret_isr, total, config_calculo, es_total_forzado)
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
                        opt.tiempo_entrega || null, // <-- Asegurarse que esta columna exista (si no, quitarla)
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

module.exports = {
    getRequisicionesCotizando,
    getRfqDetalle,
    guardarOpcionesRfq,
    enviarRfqAprobacion,
    cancelarRfq,
};