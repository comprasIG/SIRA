// C:/SIRA/backend/controllers/requisiciones.controller.js

const pool = require('../db/pool');
const { uploadRequisitionFiles } = require('../services/googleDrive');

/**
 * Crea una nueva requisición y sus detalles.
 * Maneja tanto JSON como FormData (para archivos).
 */
const crearRequisicion = async (req, res) => {
  const archivos = req.files;
  let { usuario_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, materiales } = req.body;
  
  // Conversión y validación de datos
  usuario_id = Number(usuario_id);
  proyecto_id = Number(proyecto_id);
  sitio_id = Number(sitio_id);
  if (typeof materiales === "string") {
    try { materiales = JSON.parse(materiales); } catch { materiales = []; }
  }
  if (!usuario_id || !proyecto_id || !sitio_id || !fecha_requerida || !materiales || materiales.length === 0) {
    return res.status(400).json({ error: "Faltan datos obligatorios para la requisición." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userQuery = `
      SELECT u.id, u.departamento_id, d.codigo AS depto_codigo 
      FROM usuarios u
      JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.id = $1 AND u.activo = true
    `;
    const userResult = await client.query(userQuery, [usuario_id]);
    if (userResult.rowCount === 0) {
      throw new Error("Usuario no autorizado o inactivo.");
    }
    
    const { departamento_id, depto_codigo } = userResult.rows[0];

    // 1. Primero, ejecuta la consulta y guarda el resultado en reqInsert
    const reqInsert = await client.query(
      `INSERT INTO requisiciones (usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ABIERTA') RETURNING id, numero_requisicion`,
      [usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario]
    );

    // 2. Ahora que reqInsert existe, ya puedes leer sus valores
    const requisicion_id = reqInsert.rows[0].id;
    const numero_requisicion = reqInsert.rows[0].numero_requisicion;

    // Inserta el detalle de materiales
    for (const mat of materiales) {
      await client.query(`INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`, [requisicion_id, mat.material_id, mat.cantidad, mat.comentario || null]);
    }

    // Lógica para subir archivos
     if (archivos && archivos.length > 0) {
      const archivosSubidos = await uploadRequisitionFiles(archivos, depto_codigo, numero_requisicion);
      for (const archivo of archivosSubidos) {
        await client.query(
          `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`,
          [requisicion_id, archivo.name, archivo.webViewLink]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ requisicion_id, numero_requisicion: numero_requisicion });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al crear requisición:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor." });
  } finally {
    client.release();
  }
};

/**
 * Obtiene las requisiciones pendientes de aprobación para el departamento del usuario.
 */
const getRequisicionesPorAprobar = async (req, res) => {
  const departamentoId = req.usuarioSira?.departamento_id;
  if (!departamentoId) {
    return res.status(403).json({ error: "No se pudo determinar el departamento del usuario." });
  }
  try {
    const query = `
      SELECT r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio, r.comentario, r.status
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.departamento_id = $1 AND r.status = 'ABIERTA' ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query, [departamentoId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones por aprobar:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Obtiene el detalle completo de una requisición, incluyendo materiales y adjuntos.
 */
const getRequisicionDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener datos de la cabecera de la requisición
    const reqQuery = `
      SELECT r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, 
             u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio,
             r.proyecto_id, r.sitio_id
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

    // 2. Obtener el detalle de materiales
    const materialesQuery = `
      SELECT rd.id, rd.cantidad, rd.comentario, cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON rd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
    `;
    const materialesResult = await pool.query(materialesQuery, [id]);

    const adjuntosQuery = `
      SELECT id, nombre_archivo, ruta_archivo 
      FROM requisiciones_adjuntos 
      WHERE requisicion_id = $1;
    `;
    const adjuntosResult = await pool.query(adjuntosQuery, [id]);

    // 3. Ensamblar la respuesta completa
    const requisicionCompleta = {
      ...reqResult.rows[0],
      materiales: materialesResult.rows,
      adjuntos: adjuntosResult.rows
    };

    res.json(requisicionCompleta);

  } catch (error) {
    console.error(`Error al obtener detalle de requisición ${id}:`, error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Actualiza una requisición existente.
 */
const actualizarRequisicion = async (req, res) => {
    const { id: requisicionId } = req.params;
    const archivosNuevos = req.files;
    let { materiales, adjuntosExistentes, ...otrosCampos } = req.body;

    if (typeof materiales === "string") {
        try { materiales = JSON.parse(materiales); } catch { materiales = []; }
    }
    if (typeof adjuntosExistentes === "string") {
        try { adjuntosExistentes = JSON.parse(adjuntosExistentes); } catch { adjuntosExistentes = []; }
    }
    
    if (!materiales || materiales.length === 0) {
        return res.status(400).json({ error: "La requisición debe tener al menos un material." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Actualizar la cabecera
        await client.query(
            `UPDATE requisiciones 
             SET proyecto_id = $1, sitio_id = $2, fecha_requerida = $3, lugar_entrega = $4, comentario = $5
             WHERE id = $6`,
            [otrosCampos.proyecto_id, otrosCampos.sitio_id, otrosCampos.fecha_requerida, otrosCampos.lugar_entrega, otrosCampos.comentario, requisicionId]
        );

        // 2. Reemplazar los materiales
        await client.query('DELETE FROM requisiciones_detalle WHERE requisicion_id = $1', [requisicionId]);
        for (const mat of materiales) {
            await client.query(
                `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`,
                [requisicionId, mat.material_id, mat.cantidad, mat.comentario || null]
            );
        }

        // 3. Borrar los adjuntos que el usuario eliminó
        const placeholders = adjuntosExistentes.map((_, i) => `$${i + 2}`).join(',');
        if (adjuntosExistentes.length > 0) {
          await client.query(
            `DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1 AND id NOT IN (${placeholders})`,
            [requisicionId, ...adjuntosExistentes]
          );
        } else {
          await client.query('DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1', [requisicionId]);
        }

        // 4. Subir y registrar los nuevos archivos adjuntos si existen
        if (archivosNuevos && archivosNuevos.length > 0) {
            const reqData = await client.query(
                `SELECT r.numero_requisicion, d.codigo as depto_codigo 
                 FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id 
                 WHERE r.id = $1`, [requisicionId]);
            const { numero_requisicion, depto_codigo } = reqData.rows[0];

            const archivosSubidos = await uploadRequisitionFiles(archivosNuevos, depto_codigo, numero_requisicion);

            for (const archivo of archivosSubidos) {
                await client.query(
                    `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`,
                    [requisicionId, archivo.name, archivo.webViewLink]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Requisición actualizada correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al actualizar requisición ${requisicionId}:`, error);
        res.status(500).json({ error: error.message || "Error interno del servidor." });
    } finally {
        client.release();
    }
};

/**
 * Aprueba una requisición, cambiando su estado a 'COTIZANDO'.
 */
const aprobarRequisicion = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqData = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'ABIERTA'`, [id]);
    if (reqData.rows.length === 0) {
      throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
    }
    const { numero_requisicion, depto_codigo } = reqData.rows[0];
    const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
    const consecutivo = consecutivoResult.rows[0].consecutivo;
    const numReq = numero_requisicion.split('_')[1] || '';
    const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;
    const updateResult = await client.query(`UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2 RETURNING *`, [rfq_code, id]);
    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Requisición aprobada y enviada a compras.', rfq_code: rfq_code, requisicion: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al aprobar requisición ${id}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

/**
 * Rechaza una requisición, cambiando su estado a 'CANCELADA'.
 */
const rechazarRequisicion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1 AND status = 'ABIERTA' RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'La requisición no existe o ya fue procesada.' });
    }
    res.status(200).json({ mensaje: `Requisición ${id} ha sido cancelada.` });
  } catch (error) {
    console.error(`Error al rechazar requisición ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Se exportan todas las funciones
module.exports = {
  crearRequisicion,
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  aprobarRequisicion,
  rechazarRequisicion,
  actualizarRequisicion,
};