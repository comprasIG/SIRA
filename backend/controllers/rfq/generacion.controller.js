/**
 * =================================================================================================
 * CONTROLADOR: Generación y Gestión de Cotizaciones (G-RFQ)
 * -------------------------------------------------------------------------------------------------
 * Incluye:
 * - Detalle de RFQ (GET /api/rfq/:id)
 * - Guardado de opciones (POST /api/rfq/:id/opciones)
 * - Enviar a aprobación / cancelar
 *
 * FASE 1 (Reordenamiento de materiales):
 * - Los materiales se ordenan por rd.rfq_sort_index (y fallback rd.id)
 * - Nuevo endpoint para persistir orden en BD:
 *     PUT /api/rfq/:id/materiales/orden
 *     Body: { orderedDetalleIds: number[] }
 *
 * Reglas nuevas (operación real):
 * - Un RFQ entra a VB_RFQ cuando existe al menos 1 opción seleccionada con cantidad > 0
 * - Si NO hay selecciones y NO existe ninguna OC (no cancelada), el RFQ puede regresar a COTIZANDO
 * - Si ya existe al menos 1 OC (no cancelada), el RFQ NO debe regresar a COTIZANDO automáticamente
 * - RFQs en estado CANCELADA nunca deben "revivir" por este endpoint
 * =================================================================================================
 */

const pool = require('../../db/pool');

// --- Importar funciones de Drive ---
const { uploadQuoteToReqFolder, deleteFile } = require('../../services/googleDrive');

/* =================================================================================================
 * SECCIÓN 1: Listados
 * ===============================================================================================*/

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


/* =================================================================================================
 * SECCIÓN 2: Detalle RFQ (incluye materiales + opciones)
 * ===============================================================================================*/

/**
 * GET /api/rfq/:id
 */
const getRfqDetalle = async (req, res) => {
  const { id } = req.params;

  try {
    const reqResult = await pool.query(
      `
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
      `,
      [id]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Requisición no encontrada.' });
    }

    // ✅ Materiales: ahora ordenados por rfq_sort_index
    const materialesResult = await pool.query(
      `
      SELECT
        rd.*,
        cm.nombre AS material,
        cm.sku    AS sku,
        cu.simbolo AS unidad,
        EXISTS (
          SELECT 1
          FROM ordenes_compra_detalle ocd
          WHERE ocd.requisicion_detalle_id = rd.id
        ) AS oc_generada
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON cm.id = rd.material_id
      LEFT JOIN catalogo_unidades cu ON cu.id = cm.unidad_de_compra
      WHERE rd.requisicion_id = $1
      ORDER BY rd.rfq_sort_index ASC, rd.id ASC
      `,
      [id]
    );

    const opcionesResult = await pool.query(
      `
      SELECT ro.*, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social
      FROM requisiciones_opciones ro
      JOIN proveedores p ON ro.proveedor_id = p.id
      WHERE ro.requisicion_id = $1;
      `,
      [id]
    );

    const opcionesBloqueadasResult = await pool.query(
      `SELECT ocd.comparativa_precio_id
       FROM ordenes_compra_detalle ocd
       JOIN ordenes_compra oc ON ocd.orden_compra_id = oc.id
       WHERE oc.rfq_id = $1`,
      [id]
    );
    const opcionesBloqueadas = opcionesBloqueadasResult.rows.map(r => r.comparativa_precio_id);

    const adjuntosCotizacionResult = await pool.query(
      `SELECT id, proveedor_id, nombre_archivo, ruta_archivo
       FROM rfq_proveedor_adjuntos
       WHERE requisicion_id = $1`,
      [id]
    );

    const proveedoresConOcResult = await pool.query(
      `SELECT DISTINCT proveedor_id FROM ordenes_compra WHERE rfq_id = $1`,
      [id]
    );
    const proveedoresConOc = proveedoresConOcResult.rows.map(r => r.proveedor_id);

    const adjuntosOriginalesResult = await pool.query(
      `SELECT id, nombre_archivo, ruta_archivo
       FROM requisiciones_adjuntos
       WHERE requisicion_id = $1`
      ,
      [id]
    );

    const materialesConOpciones = materialesResult.rows.map(material => ({
      ...material,
      opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id),
    }));

    res.json({
      ...reqResult.rows[0],
      materiales: materialesConOpciones,
      adjuntos_cotizacion: adjuntosCotizacionResult.rows,
      proveedores_con_oc: proveedoresConOc,
      opciones_bloqueadas: opcionesBloqueadas,
      adjuntos: adjuntosOriginalesResult.rows,
    });
  } catch (error) {
    console.error(`Error al obtener detalle de RFQ ${id}:`, error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};


/* =================================================================================================
 * SECCIÓN 3: Persistir orden de materiales (FASE 1)
 * ===============================================================================================*/

const updateRfqMaterialOrder = async (req, res) => {
  const { id: requisicionId } = req.params;
  const { orderedDetalleIds } = req.body;

  if (!Array.isArray(orderedDetalleIds) || orderedDetalleIds.length === 0) {
    return res.status(400).json({ error: "orderedDetalleIds debe ser un arreglo con al menos 1 elemento." });
  }

  // Sanitiza y valida ints
  const ids = orderedDetalleIds
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length !== orderedDetalleIds.length) {
    return res.status(400).json({ error: "orderedDetalleIds contiene valores inválidos." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar que todos pertenezcan a la requisición
    const belongs = await client.query(
      `SELECT id FROM requisiciones_detalle WHERE requisicion_id = $1 AND id = ANY($2::int[])`,
      [requisicionId, ids]
    );

    if (belongs.rowCount !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: "Algunos IDs no pertenecen a esta requisición (o ya no existen). Refresca la página e intenta de nuevo."
      });
    }

    // 2) Bulk update con index basado en la posición del array
    await client.query(
      `
      UPDATE requisiciones_detalle rd
      SET rfq_sort_index = v.idx
      FROM (
        SELECT
          unnest($1::int[]) AS id,
          (generate_subscripts($1::int[], 1) - 1) AS idx
      ) v
      WHERE rd.id = v.id
        AND rd.requisicion_id = $2;
      `,
      [ids, requisicionId]
    );

    await client.query('COMMIT');
    res.status(200).json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al actualizar orden RFQ ${requisicionId}:`, error);
    res.status(500).json({ error: "Error interno al guardar el orden." });
  } finally {
    client.release();
  }
};


/* =================================================================================================
 * SECCIÓN 4: Guardado de cotizaciones (sin cambios funcionales)
 * ===============================================================================================*/

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
      await client.query(`DELETE FROM rfq_proveedor_adjuntos WHERE id = ANY($1::int[])`, [idsABorrarSql]);

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
      await client.query(`DELETE FROM requisiciones_opciones WHERE id = ANY($1::int[])`, [idsParaBorrar]);
    }

    // =================================================================
    // UPSERT de Opciones
    // =================================================================
    for (const opt of opciones) {
      if (!opt.proveedor_id || !idsPendientes.includes(opt.requisicion_detalle_id)) continue;

      const resumenProveedor = resumenMap.get(opt.proveedor_id);

      if (opt.id) {
        if (!opcionesBloqueadas.includes(opt.id)) {
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


/* =================================================================================================
 * SECCIÓN 5: Estados
 * ===============================================================================================*/

/**
 * POST /api/rfq/:id/enviar-a-aprobacion
 *
 * Nuevo comportamiento: SYNC de estatus administrativo.
 * - RFQ CANCELADA: no se modifica.
 * - Si existe al menos 1 opción seleccionada con cantidad > 0 => POR_APROBAR
 * - Si NO hay selecciones:
 *    - si NO existe OC (no cancelada) => COTIZANDO
 *    - si SÍ existe OC (no cancelada) => NO regresa a COTIZANDO (se queda igual)
 */
const enviarRfqAprobacion = async (req, res) => {
  const { id } = req.params;

  try {
    const rfqActual = await pool.query(
      `SELECT id, status FROM requisiciones WHERE id = $1`,
      [id]
    );

    if (rfqActual.rowCount === 0) {
      return res.status(404).json({ error: 'El RFQ no existe.' });
    }

    const statusActual = rfqActual.rows[0].status;

    if (statusActual === 'CANCELADA') {
      return res.status(409).json({ error: "El RFQ está CANCELADO y no puede cambiar de estado." });
    }

    const ocExistente = await pool.query(
      `SELECT 1
       FROM ordenes_compra
       WHERE rfq_id = $1
         AND status <> 'CANCELADA'
       LIMIT 1`,
      [id]
    );
    const hayOcNoCancelada = ocExistente.rowCount > 0;

    const seleccionExistente = await pool.query(
      `SELECT 1
       FROM requisiciones_opciones
       WHERE requisicion_id = $1
         AND seleccionado = TRUE
         AND COALESCE(cantidad_cotizada, 0) > 0
       LIMIT 1`,
      [id]
    );
    const haySeleccionAsignada = seleccionExistente.rowCount > 0;

    let nuevoStatus = statusActual;

    if (haySeleccionAsignada) {
      nuevoStatus = 'POR_APROBAR';
    } else {
      if (!hayOcNoCancelada) {
        nuevoStatus = 'COTIZANDO';
      } else {
        // Si ya hay OC(s), no regresamos a G_RFQ aunque ya no haya selecciones
        nuevoStatus = statusActual;
      }
    }

    if (nuevoStatus === statusActual) {
      return res.status(200).json({
        mensaje: `Sin cambios. El RFQ permanece en '${statusActual}'.`,
        requisicion: { id: Number(id), status: statusActual },
        hayOcNoCancelada,
        haySeleccionAsignada
      });
    }

    const upd = await pool.query(
      `UPDATE requisiciones
       SET status = $2
       WHERE id = $1
       RETURNING id, status`,
      [id, nuevoStatus]
    );

    return res.status(200).json({
      mensaje: `Estatus actualizado a '${upd.rows[0].status}'.`,
      requisicion: upd.rows[0],
      hayOcNoCancelada,
      haySeleccionAsignada
    });

  } catch (error) {
    console.error(`Error al sincronizar estado RFQ ${id}:`, error);
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


/* =================================================================================================
 * SECCIÓN 6: Materiales Adicionales (agregados desde G_RFQ por compras)
 * ===============================================================================================*/

/**
 * POST /api/rfq/:id/materiales-adicionales
 * Agrega un material adicional a la requisición desde el flujo de cotización.
 * El material queda registrado con el usuario_id de compras en agregado_por_usuario_id.
 */
const agregarMaterialAdicional = async (req, res) => {
  const { id: requisicionId } = req.params;
  const { material_id, cantidad } = req.body;
  const usuarioComprasId = req.usuarioSira?.id;

  // Validaciones básicas
  if (!material_id || !cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'material_id y cantidad (> 0) son requeridos.' });
  }
  if (!usuarioComprasId) {
    return res.status(401).json({ error: 'No se pudo identificar al usuario de compras.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar que la requisición existe y está en estado válido
    const reqResult = await client.query(
      `SELECT id, status FROM requisiciones WHERE id = $1`,
      [requisicionId]
    );
    if (reqResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Requisición no encontrada.' });
    }
    const { status } = reqResult.rows[0];
    if (status === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No se pueden agregar materiales a una requisición cancelada.' });
    }

    // 2) Verificar que el material no exista ya en la requisición (constraint UNIQUE)
    const existeResult = await client.query(
      `SELECT id FROM requisiciones_detalle WHERE requisicion_id = $1 AND material_id = $2`,
      [requisicionId, material_id]
    );
    if (existeResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Este material ya existe en la requisición. No se puede agregar duplicado.',
      });
    }

    // 3) Calcular siguiente rfq_sort_index
    const maxSortResult = await client.query(
      `SELECT COALESCE(MAX(rfq_sort_index), -1) + 1 AS next_index
       FROM requisiciones_detalle WHERE requisicion_id = $1`,
      [requisicionId]
    );
    const nextSortIndex = maxSortResult.rows[0].next_index;

    // 4) Insertar en requisiciones_detalle
    const insertResult = await client.query(
      `INSERT INTO requisiciones_detalle
         (requisicion_id, material_id, cantidad, rfq_sort_index, agregado_por_usuario_id, status_compra)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
       RETURNING id`,
      [requisicionId, material_id, cantidad, nextSortIndex, usuarioComprasId]
    );
    const nuevoDetalleId = insertResult.rows[0].id;

    // 5) Obtener datos completos del material insertado para retornar al front
    const detalleResult = await client.query(
      `SELECT rd.*,
              cm.nombre AS material,
              cm.sku    AS sku,
              cu.simbolo AS unidad
       FROM requisiciones_detalle rd
       JOIN catalogo_materiales cm ON cm.id = rd.material_id
       LEFT JOIN catalogo_unidades cu ON cu.id = cm.unidad_de_compra
       WHERE rd.id = $1`,
      [nuevoDetalleId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Material adicional agregado correctamente.',
      detalle: { ...detalleResult.rows[0], opciones: [] },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al agregar material adicional a RFQ ${requisicionId}:`, error);
    if (error.constraint === 'uq_req_detalle_mat') {
      return res.status(409).json({ error: 'Este material ya existe en la requisición.' });
    }
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};


module.exports = {
  getRequisicionesCotizando,
  getRfqDetalle,
  updateRfqMaterialOrder,
  guardarOpcionesRfq,
  enviarRfqAprobacion,
  cancelarRfq,
  agregarMaterialAdicional,
};
