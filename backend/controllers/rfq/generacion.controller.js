// Ruta: backend/controllers/rfq/generacion.controller.js
// Descripción: Endpoints para flujo RFQ (generación, comparativa, envío a aprobación).
// Notas para futuros devs/IA:
// - En nuestra BD NO existe 'rfq_detalle'. El detalle de RFQ se deriva de requisiciones_detalle.
// - Los archivos de cotización por proveedor viven en 'rfq_proveedor_adjuntos'.
// - Los nombres reales de catálogo son 'catalogo_materiales' y 'catalogo_unidades'.
// - Ver DDL compartido para confirmar tablas/campos (requisiciones_opciones, ...).

const pool = require('../../db/pool');
const { uploadQuoteFile, deleteFile, downloadFileBuffer } = require('../../services/googleDrive'); // tus helpers reales
const { sendEmailWithAttachments } = require('../../services/emailService'); // si aplica

/**
 * GET /api/rfq/:id
 * Devuelve cabecera de la requisición (RFQ), su detalle (materiales) y la comparativa (opciones).
 * id = requisicion_id
 */
const getRfqDetalle = async (req, res) => {
  const { id: rfqId } = req.params;

  try {
    // 1) Cabecera de la requisición (RFQ)
    const rfqQuery = `
      SELECT r.id, r.folio, r.numero_requisicion AS rfq_code,
             r.usuario_id, r.departamento_id, r.proyecto_id, r.sitio_id,
             r.fecha_requerida, r.lugar_entrega, r.comentario_solicitante,
             r.status
      FROM requisiciones r
      WHERE r.id = $1
    `;
    const rfqRes = await pool.query(rfqQuery, [rfqId]);
    if (rfqRes.rowCount === 0) {
      return res.status(404).json({ error: 'RFQ no encontrado.' });
    }

    // 2) Materiales de la requisición
    //    NOTA: 'catalogo_materiales' tiene 'nombre' (GENERATED) y FK a 'catalogo_unidades' por 'unidad_de_compra'.
    const materialesQuery = `
      SELECT
        rd.id              AS requisicion_detalle_id,
        rd.material_id,
        rd.cantidad       AS cantidad_requerida,
        rd.comentario     AS comentario_detalle,
        cm.nombre         AS material_nombre,
        cu.simbolo        AS unidad_simbolo,
        -- Opciones de comparación para este renglón
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id',               ro.id,
            'proveedor_id',     ro.proveedor_id,
            'proveedor_razon_social', p.razon_social,
            'cantidad_cotizada',ro.cantidad_cotizada,
            'precio_unitario',  ro.precio_unitario,
            'moneda',           ro.moneda,
            'dias_entrega',     ro.tiempo_entrega_valor,
            'incluye_iva',      (ro.config_calculo->>'isIvaActive')::bool,
            'retencion_isr',    (ro.config_calculo->>'isRetIsrActive')::bool,
            'seleccionado',     ro.seleccionado
          )), '[]'::json)
          FROM requisiciones_opciones ro
          JOIN proveedores p ON p.id = ro.proveedor_id
          WHERE ro.requisicion_id = $1 AND ro.requisicion_detalle_id = rd.id
        ) AS opciones
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON cm.id = rd.material_id
      JOIN catalogo_unidades cu   ON cu.id = cm.unidad_de_compra
      WHERE rd.requisicion_id = $1
      ORDER BY cm.nombre;
    `;
    const materialesRes = await pool.query(materialesQuery, [rfqId]);

    // 3) Adjuntos de cotización por proveedor para esta requisición
    const adjuntosCotizacionRes = await pool.query(
      `SELECT id, proveedor_id, nombre_archivo, ruta_archivo
       FROM rfq_proveedor_adjuntos
       WHERE requisicion_id = $1`,
      [rfqId]
    );

    return res.json({
      rfq: rfqRes.rows[0],
      materiales: materialesRes.rows,
      adjuntos_cotizacion: adjuntosCotizacionRes.rows
    });
  } catch (error) {
    console.error("Error al obtener detalle de RFQ:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * POST /api/rfq/:id/opciones
 * Guarda/actualiza comparativa y adjuntos de cotización.
 * Notas:
 * - Inserta en rfq_proveedor_adjuntos.
 * - UPSERT en requisiciones_opciones por PK (id).
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

    // Datos para nombre de carpeta en Drive
    const reqData = await client.query(`
      SELECT r.rfq_code, d.codigo AS depto_codigo
      FROM requisiciones r
      JOIN departamentos d ON d.id = r.departamento_id
      WHERE r.id = $1
    `, [rfqId]);

    const { rfq_code: reqNum, depto_codigo: deptoCodigo } = reqData.rows[0];

    // 1) Adjuntos por proveedor
    if (archivos && archivos.length > 0) {
      for (const archivo of archivos) {
        const proveedorId = String(archivo.fieldname).split('-').pop();
        const driveFile = await uploadQuoteFile(
          archivo.buffer,
          archivo.originalname,
          archivo.mimetype,
          reqNum,
          deptoCodigo,
          proveedorId
        );

        await client.query(
          `INSERT INTO rfq_proveedor_adjuntos (requisicion_id, proveedor_id, nombre_archivo, ruta_archivo)
           VALUES ($1, $2, $3, $4)`,
          [rfqId, proveedorId, archivo.originalname, driveFile.webViewLink]
        );
      }
    }

    // 2) UPSERT de opciones
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
          cantidad_cotizada      = EXCLUDED.cantidad_cotizada,
          precio_unitario        = EXCLUDED.precio_unitario,
          moneda                 = EXCLUDED.moneda,
          tiempo_entrega_valor   = EXCLUDED.tiempo_entrega_valor,
          config_calculo         = EXCLUDED.config_calculo,
          seleccionado           = EXCLUDED.seleccionado
      `;
      for (const opt of opciones) {
        const config = { isIvaActive: !!opt.incluye_iva, isRetIsrActive: !!opt.retencion_isr };
        await client.query(upsertQuery, [
          opt.id, rfqId, opt.requisicion_detalle_id, opt.proveedor_id,
          opt.cantidad_cotizada, opt.precio_unitario, opt.moneda, opt.dias_entrega,
          config, opt.seleccionado
        ]);
      }
    }

    // 3) Limpieza inteligente de opciones no presentes (y no bloqueadas en OC)
    const opcionesEnPayload = (opciones || []).map(o => o.id);
    const opcionesBloqueadasRes = await client.query(
      `SELECT DISTINCT comparativa_precio_id
         FROM ordenes_compra_detalle
        WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE requisicion_id = $1)`,
      [rfqId]
    );
    const opcionesBloqueadas = opcionesBloqueadasRes.rows.map(r => r.comparativa_precio_id);

    const idsPendientesRes = await client.query(
      `SELECT id FROM requisiciones_opciones
        WHERE requisicion_id = $1
          AND (NOT (id = ANY($2)))`,
      [rfqId, opcionesBloqueadas] // luego filtramos en JS
    );
    const idsPendientes = idsPendientesRes.rows.map(r => r.id);
    const idsParaBorrar = idsPendientes
      .filter(id => !opcionesEnPayload.includes(id))
      .filter(id => !opcionesBloqueadas.includes(id));

    if (idsParaBorrar.length > 0) {
      await client.query(
        `DELETE FROM requisiciones_opciones WHERE id = ANY($1)`,
        [idsParaBorrar]
      );
    }

    // 4) Sincronizar adjuntos borrados desde UI (si mandas estructura 'proveedores' con adjuntos)
    const adjuntosIds = (proveedores || [])
      .flatMap(p => (p.adjuntos || []).map(a => Number(a.id)))
      .filter(Boolean);

    if (adjuntosIds.length > 0) {
      const adjuntosBorradosRes = await client.query(
        `SELECT id, ruta_archivo
           FROM rfq_proveedor_adjuntos
          WHERE requisicion_id = $1
            AND id NOT IN (SELECT UNNEST($2::int[]))`,
        [rfqId, adjuntosIds]
      );

      for (const adj of adjuntosBorradosRes.rows) {
        try {
          const fileId = adj.ruta_archivo.split('/view')[0].split('/').pop();
          if (fileId) await deleteFile(fileId);
        } catch (e) {
          console.warn(`No se pudo borrar en Drive el adjunto ${adj.id}.`, e);
        }
        await client.query('DELETE FROM rfq_proveedor_adjuntos WHERE id = $1', [adj.id]);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ mensaje: 'Comparativa guardada exitosamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al guardar opciones de RFQ:", error);
    return res.status(500).json({ error: error.message || "Error interno al guardar la comparativa." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/rfq/:id/enviar-aprobacion
 * Cambia status de la requisición de COTIZANDO -> POR_APROBAR.
 */
const enviarAAprobacion = async (req, res) => {
  const { id: rfqId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE requisiciones
          SET status = 'POR_APROBAR'
        WHERE id = $1 AND status = 'COTIZANDO'
      RETURNING id, status`,
      [rfqId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'La requisición no se encontró o está en un estado no válido.' });
    }
    return res.status(200).json({
      mensaje: 'La RFQ ha sido enviada a aprobación.',
      requisicion: result.rows[0]
    });
  } catch (error) {
    console.error(`Error al enviar a aprobación la RFQ ${rfqId}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getRfqDetalle,
  guardarOpcionesRfq,
  enviarAAprobacion,
};
