// C:\SIRA\backend\controllers\rfq\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación y Gestión de Cotizaciones (G-RFQ)
 * VERSIÓN REFACTORIZADA: 3.1 (Corrección de importación de Drive)
 * =================================================================================================
 * --- HISTORIAL DE CAMBIOS ---
 * v3.1: Se corrige la importación de 'uploadQuoteToReqFolder' (que no existe)
 * por 'uploadQuoteFile' (que sí existe). Se actualiza la llamada a la función.
 */
const pool = require('../../db/pool');
// --- CORRECCIÓN ---
// Se importa 'uploadQuoteFile' (la función real) y 'deleteFile'
const { uploadQuoteFile, deleteFile } = require('../../services/googleDrive');

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
 * Obtiene el detalle completo de un RFQ (materiales, opciones, adjuntos)
 */
const getRfqDetalle = async (req, res) => {
    const { id: rfqId } = req.params;
    try {
        const rfqQuery = `
            SELECT r.id, r.rfq_code, r.status, r.lugar_entrega,
                   u.nombre as comprador_nombre,
                   (SELECT COUNT(DISTINCT proveedor_id) FROM requisiciones_opciones WHERE requisicion_id = r.id) as num_proveedores,
                   (SELECT json_agg(json_build_object(
                       'id', p.id,
                       'razon_social', p.razon_social,
                       'nombre', p.nombre
                   )) FROM (
                       SELECT DISTINCT p.id, p.razon_social, p.nombre
                       FROM requisiciones_opciones ro
                       JOIN proveedores p ON ro.proveedor_id = p.id
                       WHERE ro.requisicion_id = r.id
                   ) p) as proveedores,
                   (SELECT json_agg(json_build_object(
                      'id', ocd.comparativa_precio_id,
                      'proveedor_id', p.id,
                      'proveedor_nombre', p.nombre
                   ))
                    FROM ordenes_compra_detalle ocd
                    JOIN ordenes_compra oc ON ocd.orden_compra_id = oc.id
                    LEFT JOIN requisiciones_opciones ro ON ocd.comparativa_precio_id = ro.id
                    LEFT JOIN proveedores p ON ro.proveedor_id = p.id
                    WHERE oc.rfq_id = r.id
                   ) as proveedores_con_oc
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            WHERE r.id = $1;
        `;
        const rfqRes = await pool.query(rfqQuery, [rfqId]);
        if (rfqRes.rowCount === 0) return res.status(404).json({ error: 'RFQ no encontrado.' });

        const materialesQuery = `
            SELECT
                rd.id AS rfq_detalle_id,
                rd.requisicion_detalle_id,
                m.id AS material_id,
                m.nombre AS material,
                m.descripcion AS material_descripcion,
                rd.cantidad_requerida,
                m.unidad AS unidad_medida,
                (SELECT json_agg(json_build_object(
                    'id', ro.id,
                    'proveedor_id', ro.proveedor_id,
                    'proveedor_razon_social', p.razon_social,
                    'proveedor_nombre', p.nombre,
                    'cantidad_cotizada', ro.cantidad_cotizada,
                    'precio_unitario', ro.precio_unitario,
                    'moneda', ro.moneda,
                    'dias_entrega', ro.tiempo_entrega_valor,
                    'incluye_iva', ro.config_calculo->>'isIvaActive',
                    'retencion_isr', ro.config_calculo->>'isRetIsrActive',
                    'seleccionado', ro.seleccionado,
                    'oc_generada', (ro.comparativa_precio_id_oc IS NOT NULL)
                ))
                FROM requisiciones_opciones ro
                JOIN proveedores p ON ro.proveedor_id = p.id
                WHERE ro.requisicion_detalle_id = rd.requisicion_detalle_id) AS opciones
            FROM rfq_detalle rd
            JOIN requisiciones_detalle reqd ON rd.requisicion_detalle_id = reqd.id
            JOIN materiales m ON reqd.material_id = m.id
            WHERE rd.rfq_id = $1
            ORDER BY m.nombre;
        `;
        const materialesRes = await pool.query(materialesQuery, [rfqId]);

        // (RF-v3) Obtener IDs de opciones bloqueadas
        const opcionesBloqueadasRes = await pool.query(
            `SELECT DISTINCT comparativa_precio_id FROM ordenes_compra_detalle
             WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE rfq_id = $1)`,
            [rfqId]
        );
        const opciones_bloqueadas = opcionesBloqueadasRes.rows.map(r => Number(r.comparativa_precio_id));
        
        // (RF-v3) Obtener adjuntos de cotizaciones
        const adjuntosCotizacionRes = await pool.query(
            `SELECT id, proveedor_id, nombre_archivo, ruta_archivo 
             FROM rfq_proveedor_adjuntos WHERE requisicion_id = $1`,
            [rfqId]
        );

        res.json({
            ...rfqRes.rows[0],
            materiales: materialesRes.rows,
            opciones_bloqueadas: opciones_bloqueadas,
            adjuntos_cotizacion: adjuntosCotizacionRes.rows
        });
    } catch (error) {
        console.error("Error al obtener detalle de RFQ:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/rfq/:id/opciones
 * Guarda/Actualiza las opciones de cotización (comparativa) y los archivos adjuntos.
 */
const guardarOpcionesRfq = async (req, res) => {
  const { id: rfqId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  let { opciones, proveedores } = req.body;
  const archivos = req.files;

  if (typeof opciones === 'string') opciones = JSON.parse(opciones);
  if (typeof proveedores === 'string') proveedores = JSON.parse(proveedores);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqData = await client.query(`
        SELECT r.rfq_code, d.codigo as depto_codigo
        FROM requisiciones r
        JOIN departamentos d ON r.departamento_id = d.id
        WHERE r.id = $1
    `, [rfqId]);
    const { rfq_code: reqNum, depto_codigo: deptoCodigo } = reqData.rows[0];

    // 1. Manejar Archivos Adjuntos
    if (archivos && archivos.length > 0) {
      for (const archivo of archivos) {
        const fieldNameParts = archivo.fieldname.split('-'); // ej: 'cotizacion-archivo-123'
        const proveedorId = fieldNameParts[fieldNameParts.length - 1];
        
        const fileBuffer = archivo.buffer;
        const fileName = archivo.originalname;
        const mimeType = archivo.mimetype;

        // --- CORRECCIÓN ---
        // Se llama a 'uploadQuoteFile' (la función real)
        const driveFile = await uploadQuoteFile(
            fileBuffer,
            fileName,
            mimeType,
            reqNum,
            deptoCodigo,
            proveedorId
        );

        await client.query(
          `INSERT INTO rfq_proveedor_adjuntos (requisicion_id, proveedor_id, nombre_archivo, ruta_archivo, mime_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [rfqId, proveedorId, fileName, driveFile.webViewLink, mimeType]
        );
      }
    }

    // 2. Manejar Opciones (UPSERT)
    if (opciones && opciones.length > 0) {
      const upsertQuery = `
          INSERT INTO requisiciones_opciones (
              id, requisicion_id, requisicion_detalle_id, proveedor_id,
              cantidad_cotizada, precio_unitario, moneda, tiempo_entrega_valor,
              config_calculo, seleccionado
          ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          ON CONFLICT (id) DO UPDATE SET
              cantidad_cotizada = EXCLUDED.cantidad_cotizada,
              precio_unitario = EXCLUDED.precio_unitario,
              moneda = EXCLUDED.moneda,
              tiempo_entrega_valor = EXCLUDED.tiempo_entrega_valor,
              config_calculo = EXCLUDED.config_calculo,
              seleccionado = EXCLUDED.seleccionado;
      `;
      for (const opt of opciones) {
        const config = { isIvaActive: opt.incluye_iva, isRetIsrActive: opt.retencion_isr };
        await client.query(upsertQuery, [
            opt.id, rfqId, opt.requisicion_detalle_id, opt.proveedor_id,
            opt.cantidad_cotizada, opt.precio_unitario, opt.moneda, opt.dias_entrega,
            config, opt.seleccionado
        ]);
      }
    }

    // 3. (RF-v3) BORRADO INTELIGENTE
    // Borrar solo las opciones que no están en el payload Y que no están bloqueadas por una OC
    const opcionesEnPayload = opciones.map(o => o.id);
    const opcionesBloqueadasRes = await pool.query(
        `SELECT DISTINCT comparativa_precio_id FROM ordenes_compra_detalle
         WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE rfq_id = $1)`,
        [rfqId]
    );
    const opcionesBloqueadas = opcionesBloqueadasRes.rows.map(r => r.comparativa_precio_id);

    // Obtener todos los IDs PENDIENTES de la BBDD (no bloqueados)
    const idsPendientesQuery = `
        SELECT id FROM requisiciones_opciones 
        WHERE requisicion_id = $1 
        AND id NOT IN (${opcionesBloqueadas.map(id => `'${id}'`).join(',') || 'NULL'})
    `;
    const idsPendientesRes = await client.query(idsPendientesQuery, [rfqId]);
    const idsPendientes = idsPendientesRes.rows.map(r => r.id);

    // IDs para borrar = (IDs Pendientes) - (IDs en Payload)
    const idsParaBorrar = idsPendientes.filter(id => !opcionesEnPayload.includes(id));

    if (idsParaBorrar.length > 0) {
      await client.query(
        `DELETE FROM requisiciones_opciones WHERE id IN (${idsParaBorrar.map(id => `'${id}'`).join(',')})`,
      );
    }
    
    // 4. (RF-v3) Sincronizar adjuntos borrados
    const adjuntosIds = (proveedores || []).flatMap(p => (p.adjuntos || []).map(a => a.id));
    const adjuntosBorradosQuery = `
        SELECT id, ruta_archivo FROM rfq_proveedor_adjuntos
        WHERE requisicion_id = $1 
        AND id NOT IN (${adjuntosIds.map(id => `${id}`).join(',') || 'NULL'})
    `;
    const adjuntosBorradosRes = await client.query(adjuntosBorradosQuery, [rfqId]);
    
    for (const adjunto of adjuntosBorradosRes.rows) {
        try {
            const fileId = adjunto.ruta_archivo.split('/view')[0].split('/').pop();
            if (fileId) {
                await deleteFile(fileId); // Borrar de Drive
            }
        } catch (driveErr) {
            console.warn(`No se pudo borrar el adjunto ${adjunto.id} de Drive. Continuando...`);
        }
        await client.query('DELETE FROM rfq_proveedor_adjuntos WHERE id = $1', [adjunto.id]);
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Comparativa guardada exitosamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al guardar opciones de RFQ:", error);
    res.status(500).json({ error: error.message || "Error interno al guardar la comparativa." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/rfq/:id/enviar-aprobacion
 */
const enviarAAprobacion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'POR_APROBAR'
             WHERE id = $1 AND status = 'COTIZANDO' RETURNING id, status`,
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
        if (rfqActual.rowCount === 0) return res.status(4404).json({ error: 'El RFQ no existe.' });
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
    enviarAAprobacion,
    cancelarRfq
};