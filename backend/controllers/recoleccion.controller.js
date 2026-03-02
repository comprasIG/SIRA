// backend/controllers/recoleccion.controller.js
const pool = require('../db/pool');
const { uploadOcEvidenceFile } = require('../services/googleDrive');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const SKU_EVENTO_MAP = {
  'SERV-VEH-PREV': 'SERVICIO_PREV',
  'SERV-VEH-CORR': 'SERVICIO_CORR',
  'LLANTA-GEN': 'LLANTAS',
  'COMBUS-GEN': 'COMBUSTIBLE',
};

const getOcsAprobadas = async (req, res) => {
  // Esta es la línea clave de la corrección
  const { departamentoId, sitioId, proyectoId, proveedorId, search } = req.query;

  let query = `
    SELECT
      oc.id, oc.numero_oc, oc.total, oc.fecha_creacion, oc.status,
      p.razon_social AS proveedor_razon_social,
      p.marca AS proveedor_marca,
      pr.nombre AS proyecto_nombre,
      s.nombre AS sitio_nombre,
      d.nombre AS departamento_nombre,
      r.departamento_id,
      oc.sitio_id,
      oc.proyecto_id,
      oc.proveedor_id
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN proyectos pr ON oc.proyecto_id = pr.id
    JOIN sitios s ON oc.sitio_id = s.id
    JOIN requisiciones r ON oc.rfq_id = r.id
    JOIN departamentos d ON r.departamento_id = d.id
    WHERE oc.status = 'APROBADA'
  `;

  const params = [];
  let paramIndex = 1;

  if (departamentoId) {
    query += ` AND r.departamento_id = $${paramIndex++}`;
    params.push(departamentoId);
  }
  if (sitioId) {
    query += ` AND oc.sitio_id = $${paramIndex++}`;
    params.push(sitioId);
  }
  if (proyectoId) {
    query += ` AND oc.proyecto_id = $${paramIndex++}`;
    params.push(proyectoId);
  }
  if (proveedorId) {
    query += ` AND oc.proveedor_id = $${paramIndex++}`;
    params.push(proveedorId);
  }
  if (search) {
    query += ` AND (oc.numero_oc ILIKE $${paramIndex} OR p.marca ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY oc.fecha_creacion DESC';

  try {
    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener OCs aprobadas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


const procesarOcParaRecoleccion = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const {
        metodoRecoleccionId,
        paqueteriaId,
        numeroGuia,
        comentarioRecoleccion,
        paqueteriaPago,
        entregaResponsable, // <<< NUEVO CAMPO
        notificarRecoleccion,
        notificarProveedor,
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ocQuery = await client.query(`
            SELECT oc.*, r.numero_requisicion, d.codigo AS depto_codigo
            FROM ordenes_compra oc
            JOIN requisiciones r ON oc.rfq_id = r.id
            JOIN departamentos d ON r.departamento_id = d.id
            WHERE oc.id = $1 FOR UPDATE
        `, [ordenCompraId]);
        if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });

        const oc = ocQuery.rows[0];
        if (oc.status !== 'APROBADA') {
            return res.status(409).json({ error: `La OC está en estado '${oc.status}' y no puede ser procesada.` });
        }

        const archivosSubidos = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileName = `EVIDENCIA_${oc.numero_oc}_${Date.now()}_${file.originalname}`;
                const driveFile = await uploadOcEvidenceFile(file, oc.depto_codigo, oc.numero_requisicion, oc.numero_oc, fileName);
                const insertRes = await client.query(
                    `INSERT INTO archivos_recoleccion_oc (orden_compra_id, archivo_link, tipo) VALUES ($1, $2, $3) RETURNING *`,
                    [ordenCompraId, driveFile.webViewLink, 'EVIDENCIA_EMBARQUE']
                );
                archivosSubidos.push(insertRes.rows[0]);
            }
        }

        const finalPaqueteriaId = paqueteriaId ? parseInt(paqueteriaId, 10) : null;
        const finalNumeroGuia = numeroGuia || null;
        
        const updateResult = await client.query(
            `UPDATE ordenes_compra
             SET
               status = 'EN_PROCESO',
               metodo_recoleccion_id = $2,
               paqueteria_id = $3,
               numero_guia = $4,
               comentario_recoleccion = $5,
               paqueteria_pago = $6,
               entrega_responsable = $7, -- <<< NUEVA LÍNEA
               actualizado_en = now()
             WHERE id = $1
             RETURNING id, status`,
            [ordenCompraId, metodoRecoleccionId, finalPaqueteriaId, finalNumeroGuia, comentarioRecoleccion, paqueteriaPago, entregaResponsable]
        );

        // Notificaciones simuladas
        if (notificarRecoleccion === 'true') {
            await sendWhatsAppMessage('RECOLECCIONES_GROUP', `Nueva OC para recolección: ${oc.numero_oc}`);
        }
        if (notificarProveedor === 'true') {
            // El mensaje podría variar según 'entregaResponsable' en el futuro
            await sendWhatsAppMessage('PROVEEDOR_CONTACT', `Su OC ${oc.numero_oc} está en proceso de recolección.`);
        }

        // Registro en el historial
        const detallesHistorial = {
            accion: 'Paso a Recolección',
            nuevo_estado: 'EN_PROCESO',
            metodoRecoleccionId, paqueteriaId: finalPaqueteriaId, numeroGuia: finalNumeroGuia,
            paqueteriaPago, comentarioRecoleccion, entregaResponsable,
            notificaciones: { recoleccion: notificarRecoleccion, proveedor: notificarProveedor },
            archivos: archivosSubidos.map(a => a.archivo_link),
        };

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, 'PROCESO_RECOLECCION', $3)`,
            [ordenCompraId, usuarioId, JSON.stringify(detallesHistorial)]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'OC actualizada a EN_PROCESO.', ordenCompra: updateResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al procesar OC para recolección:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const cancelarOcAprobada = async (req, res) => {
    const { id, motivo } = req.body;
    const { id: usuarioId } = req.usuarioSira;

    if (!id || !motivo || motivo.trim() === '') {
        return res.status(400).json({ error: 'La OC y el motivo son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const ocQuery = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [id]);
        if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
        if (ocQuery.rows[0].status !== 'APROBADA') {
            return res.status(409).json({ error: 'Solo se pueden cancelar OCs en estado APROBADA.' });
        }

        await client.query(
            `UPDATE ordenes_compra SET status = 'CANCELADA' WHERE id = $1`,
            [id]
        );

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
            VALUES ($1, $2, 'CANCELACION_POST_APROBACION', $3)`,
            [id, usuarioId, JSON.stringify({ motivo })]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'OC cancelada exitosamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cancelar OC aprobada:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const getRecoleccionKpis = async (_req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'APROBADA') AS pendientes,
                COUNT(*) FILTER (WHERE status = 'EN_PROCESO') AS en_recoleccion
            FROM ordenes_compra;
        `;
        const { rows } = await pool.query(query);
        res.json({
            pendientes: parseInt(rows[0].pendientes, 10) || 0,
            enRecoleccion: parseInt(rows[0].en_recoleccion, 10) || 0,
        });
    } catch (error) {
        console.error('Error al obtener KPIs de recolección:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getOcsEnProceso = async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT oc.id, oc.numero_oc, p.marca AS proveedor_marca
            FROM ordenes_compra oc
            JOIN proveedores p ON oc.proveedor_id = p.id
            WHERE oc.status = 'EN_PROCESO'
            ORDER BY oc.actualizado_en DESC;
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener OCs En Proceso:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getDatosParaFiltros = async (_req, res) => {
    try {
        // --- CONSULTAS MODIFICADAS ---
        // Ahora solo traen opciones que tienen al menos una OC en estado APROBADA.
        const proveedoresQuery = `
            SELECT DISTINCT p.id, p.marca FROM proveedores p
            JOIN ordenes_compra oc ON p.id = oc.proveedor_id
            WHERE oc.status = 'APROBADA' ORDER BY p.marca ASC
        `;
        const sitiosQuery = `
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN ordenes_compra oc ON s.id = oc.sitio_id
            WHERE oc.status = 'APROBADA' ORDER BY s.nombre ASC
        `;
        const proyectosQuery = `
            SELECT DISTINCT pr.id, pr.nombre, pr.sitio_id FROM proyectos pr
            JOIN ordenes_compra oc ON pr.id = oc.proyecto_id
            WHERE oc.status = 'APROBADA' ORDER BY pr.nombre ASC
        `;
        const departamentosQuery = `
            SELECT DISTINCT d.id, d.nombre FROM departamentos d
            JOIN requisiciones r ON d.id = r.departamento_id
            JOIN ordenes_compra oc ON r.id = oc.rfq_id
            WHERE oc.status = 'APROBADA' ORDER BY d.nombre ASC
        `;

        const [proveedoresRes, sitiosRes, proyectosRes, departamentosRes] = await Promise.all([
            pool.query(proveedoresQuery),
            pool.query(sitiosQuery),
            pool.query(proyectosQuery),
            pool.query(departamentosQuery),
        ]);

        res.json({
            proveedores: proveedoresRes.rows,
            sitios: sitiosRes.rows,
            proyectos: proyectosRes.rows,
            departamentos: departamentosRes.rows
        });
    } catch (error) {
        console.error('Error al obtener datos para filtros:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * @description Cierra una Orden de Compra Vehicular.
 * (MODIFICADO: Ahora busca el unidad_id real antes de insertar en bitácora)
 */
const cerrarOcVehicular = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const {
    kilometraje_final,
    numeros_serie,
    comentario_cierre,
  } = req.body;

  const kmNum = parseInt(kilometraje_final, 10);
  if (!kmNum || kmNum <= 0) {
    return res.status(400).json({ error: 'El kilometraje final es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener datos de la OC y bloquearla
    const ocQuery = await client.query(
      `SELECT proyecto_id, total, rfq_id, status, numero_oc 
       FROM ordenes_compra 
       WHERE id = $1 FOR UPDATE`,
      [ordenCompraId]
    );

    if (ocQuery.rowCount === 0) throw new Error('Orden de Compra no encontrada.');
    
    const oc = ocQuery.rows[0];
    const proyectoEspejoId = oc.proyecto_id; // Este es el ID del proyecto (ej: 23)
    const requisicionId = oc.rfq_id; 

    if (oc.status !== 'APROBADA' && oc.status !== 'EN_PROCESO') {
      throw new Error(`La OC no puede cerrarse, su estado es '${oc.status}'.`);
    }

    // ==========================================================
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Necesitamos encontrar el 'unidad.id' real (ej: 14) usando el 'proyecto_id' (ej: 23)
    // ==========================================================
    const unidadQuery = await client.query(
      `SELECT u.id, u.km 
       FROM unidades u
       JOIN proyectos p ON u.unidad = p.nombre -- Unimos por nombre
       WHERE p.id = $1 AND p.sitio_id = (SELECT id FROM sitios WHERE nombre = 'UNIDADES')`,
      [proyectoEspejoId]
    );

    if (unidadQuery.rowCount === 0) {
      throw new Error(`No se pudo encontrar la unidad correspondiente al proyecto ID ${proyectoEspejoId}.`);
    }
    const unidadId = unidadQuery.rows[0].id; // <<< ¡Este es el ID correcto (ej: 14)!
    const kmActual = unidadQuery.rows[0].km || 0;

    // 1b. Validar Kilometraje
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }
    // ==========================================================

    
    // 2. Obtener el SKU de la OC (sin cambios)
    const detalleQuery = await client.query(
      `SELECT m.sku 
       FROM ordenes_compra_detalle od
       JOIN catalogo_materiales m ON od.material_id = m.id
       WHERE od.orden_compra_id = $1
       LIMIT 1`,
      [ordenCompraId]
    );
    if (detalleQuery.rowCount === 0) throw new Error('No se encontraron detalles en la OC.');
    
    const sku = detalleQuery.rows[0].sku;
    const eventoCodigo = SKU_EVENTO_MAP[sku];
    if (!eventoCodigo) throw new Error(`SKU no reconocido para bitácora vehicular: ${sku}`);

    const eventoQuery = await client.query(`SELECT id FROM unidades_evento_tipos WHERE codigo = $1`, [eventoCodigo]);
    const eventoTipoId = eventoQuery.rows[0]?.id;
    if (!eventoTipoId) throw new Error(`Código de evento no encontrado en la BD: ${eventoCodigo}`);

    // 3. Actualizar la OC a ENTREGADA (sin cambios)
    await client.query(
      `UPDATE ordenes_compra SET status = 'ENTREGADA', actualizado_en = NOW() WHERE id = $1`,
      [ordenCompraId]
    );

    // 3b. Actualizar la Requisición original a ENTREGADA (sin cambios)
    await client.query(
      `UPDATE requisiciones SET status = 'ENTREGADA', actualizado_en = NOW() WHERE id = $1`,
      [requisicionId]
    );

    // 4. Insertar el registro final en la bitácora
    const descripcionFinal = `Cierre de OC ${oc.numero_oc}. ${comentario_cierre || ''}`;
    await client.query(
      `INSERT INTO unidades_historial 
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, costo_total, numeros_serie, usuario_id, orden_compra_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)`,
      [
        unidadId, // <<< ¡CORREGIDO! Usamos el ID de la unidad real
        kmNum,
        eventoTipoId,
        descripcionFinal,
        oc.total, 
        numeros_serie || null,
        usuarioId,
        ordenCompraId
      ]
    );

    // 5. Actualizar el KM maestro en la tabla de unidades
    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidadId]); // <-- ¡CORREGIDO!
    
    await client.query('COMMIT');
    res.status(200).json({ mensaje: `Servicio para OC ${oc.numero_oc} cerrado y registrado en bitácora.` });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al cerrar OC vehicular ${ordenCompraId}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/recoleccion/ocs/:id/cerrar-incrementable
 * Aplica la distribución de costos incrementables al inventario (costos_incrementables JSONB).
 * No ingresa nada al stock físico; solo actualiza el campo de costos adicionales por artículo.
 * ───────────────────────────────────────────────────────────────────────────*/
const cerrarIncrementable = async (req, res) => {
  const { id: ocId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  const idNum = Number(ocId);

  if (!idNum) return res.status(400).json({ error: 'ID de OC inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar OC y obtener datos
    const ocRes = await client.query(
      `SELECT oc.id, oc.numero_oc, oc.status, io.id AS incrementable_id
       FROM ordenes_compra oc
       JOIN incrementables_oc io ON io.oc_incrementable_id = oc.id
       WHERE oc.id = $1
       FOR UPDATE OF oc`,
      [idNum]
    );

    if (ocRes.rowCount === 0) {
      throw new Error(`La OC ${idNum} no es una OC incrementable o no existe.`);
    }

    const oc = ocRes.rows[0];

    if (!['APROBADA', 'EN_PROCESO'].includes(oc.status)) {
      throw new Error(`La OC ${oc.numero_oc} tiene status ${oc.status}. Solo se puede cerrar si está APROBADA o EN_PROCESO.`);
    }

    // 2) Obtener distribución pendiente de aplicar
    const distRes = await client.query(
      `SELECT id, material_id, monto_incrementable, moneda_incrementable, oc_base_id
       FROM incrementables_distribucion_items
       WHERE incrementable_id = $1 AND aplicado_en IS NULL`,
      [oc.incrementable_id]
    );

    // 3) Obtener descripción del tipo de incrementable para el JSON
    const tipoRes = await client.query(
      `SELECT ti.nombre
       FROM incrementables_oc io
       JOIN tipo_incrementables ti ON io.tipo_incrementable_id = ti.id
       WHERE io.id = $1`,
      [oc.incrementable_id]
    );
    const tipoNombre = tipoRes.rows[0]?.nombre || 'Incrementable';

    // 4) Aplicar al inventario: actualizar costos_incrementables JSONB por material
    for (const item of distRes.rows) {
      const entrada = JSON.stringify({
        incrementable_id: oc.incrementable_id,
        oc_incrementable_id: idNum,
        descripcion: tipoNombre,
        monto: item.monto_incrementable,
        moneda: item.moneda_incrementable,
        oc_base_id: item.oc_base_id,
        aplicado_en: new Date().toISOString(),
      });

      // Append a la columna JSONB (soporta multi-moneda de forma nativa)
      await client.query(
        `UPDATE inventario_actual
         SET costos_incrementables = costos_incrementables || $1::jsonb
         WHERE material_id = $2`,
        [`[${entrada}]`, item.material_id]
      );

      // Marcar como aplicado
      await client.query(
        `UPDATE incrementables_distribucion_items
         SET aplicado_en = NOW()
         WHERE id = $1`,
        [item.id]
      );
    }

    // 5) Cerrar la OC incrementable
    await client.query(
      `UPDATE ordenes_compra SET status = 'ENTREGADA', actualizado_en = NOW() WHERE id = $1`,
      [idNum]
    );

    // 6) Auditoría
    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, 'ENTREGADA', $3)`,
      [idNum, usuarioId, `Incrementable cerrado. ${distRes.rowCount} artículos afectados.`]
    );

    await client.query('COMMIT');

    res.json({
      mensaje: `OC incrementable ${oc.numero_oc} cerrada. ${distRes.rowCount} artículo(s) actualizados en inventario.`,
      articulos_actualizados: distRes.rowCount,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[INCREMENTABLES] Error en cerrarIncrementable:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getOcsAprobadas,
  procesarOcParaRecoleccion,
  cancelarOcAprobada,
  getRecoleccionKpis,
  getOcsEnProceso,
  getDatosParaFiltros,
  cerrarOcVehicular,
  cerrarIncrementable,
};