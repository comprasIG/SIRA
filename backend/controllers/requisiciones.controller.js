// src/controllers/requisiciones.controller.js

const pool = require('../db/pool');

/**
 * Crea una nueva requisición y sus detalles.
 * Espera en el body: usuario_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, materiales[]
 */
const crearRequisicion = async (req, res) => {
  const {
    usuario_id,
    proyecto_id,
    sitio_id,
    fecha_requerida,
    lugar_entrega,
    comentario,
    materiales
  } = req.body;

  if (!usuario_id || !proyecto_id || !sitio_id || !fecha_requerida || !materiales || materiales.length === 0) {
    return res.status(400).json({ error: "Faltan datos obligatorios para la requisición." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // (1) Validar que el usuario existe y está activo
    const userResult = await client.query(
      "SELECT id, departamento_id FROM usuarios WHERE id = $1 AND activo = true",
      [usuario_id]
    );
    if (userResult.rowCount === 0) {
      throw new Error("Usuario no autorizado o inactivo.");
    }

    // (2) Obtener el departamento_id del usuario
    const departamento_id = userResult.rows[0].departamento_id;

    // (3) Insertar en la tabla requisiciones, incluyendo departamento_id
    const reqInsert = await client.query(
      `INSERT INTO requisiciones (
        usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, status, fecha_creacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ABIERTA', NOW())
      RETURNING id, numero_requisicion`,
      [usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario]
    );
    const requisicion_id = reqInsert.rows[0].id;
    const numero_requisicion = reqInsert.rows[0].numero_requisicion;

    // (4) Insertar los materiales (detalles)
    for (const mat of materiales) {
      await client.query(
        `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
         VALUES ($1, $2, $3, $4)`,
        [requisicion_id, mat.material_id, mat.cantidad, mat.comentario || null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ requisicion_id, numero_requisicion });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al crear requisición:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor." });
  } finally {
    client.release();
  }
};

/**
 * Obtiene las requisiciones pendientes de aprobación para el departamento del usuario logueado.
 */
const getRequisicionesPorAprobar = async (req, res) => {
  const departamentoId = req.usuarioSira?.departamento_id;

  if (!departamentoId) {
    return res.status(403).json({ error: "No se pudo determinar el departamento del usuario." });
  }

  try {
    const query = `
      SELECT 
        r.id,
        r.numero_requisicion,
        r.fecha_creacion,
        r.fecha_requerida,
        u.nombre AS usuario_creador,
        p.nombre AS proyecto,
        s.nombre AS sitio,
        r.comentario,
        r.status
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.departamento_id = $1 AND r.status = 'ABIERTA'
      ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query, [departamentoId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones por aprobar:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Obtiene el detalle completo de una requisición específica, incluyendo sus materiales.
 */
const getRequisicionDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    const reqQuery = `
      SELECT 
        r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida,
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
        cm.nombre AS material,
        cu.simbolo AS unidad
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON rd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE rd.requisicion_id = $1
      ORDER BY cm.nombre;
    `;
    const materialesResult = await pool.query(materialesQuery, [id]);

    const requisicionCompleta = {
      ...reqResult.rows[0],
      materiales: materialesResult.rows
    };

    res.json(requisicionCompleta);

  } catch (error) {
    console.error(`Error al obtener detalle de requisición ${id}:`, error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Aprueba una requisición, cambiando su estado a 'COTIZANDO' y generando un RFQ code.
 */
const aprobarRequisicion = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reqData = await client.query(
      `SELECT r.numero_requisicion, d.codigo as depto_codigo 
       FROM requisiciones r 
       JOIN departamentos d ON r.departamento_id = d.id 
       WHERE r.id = $1 AND r.status = 'ABIERTA'`,
      [id]
    );

    if (reqData.rows.length === 0) {
      throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
    }

    const { numero_requisicion, depto_codigo } = reqData.rows[0];
    const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
    const consecutivo = consecutivoResult.rows[0].consecutivo;
    const numReq = numero_requisicion.split('_')[1] || '';
    const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;

    const updateResult = await client.query(
      `UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2 RETURNING *`,
      [rfq_code, id]
    );

    await client.query('COMMIT');
    res.status(200).json({ 
      mensaje: 'Requisición aprobada y enviada a compras.',
      rfq_code: rfq_code,
      requisicion: updateResult.rows[0]
    });

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
    const result = await pool.query(
      `UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1 AND status = 'ABIERTA' RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'La requisición no existe o ya fue procesada.' });
    }
    res.status(200).json({ mensaje: `Requisición ${id} ha sido cancelada.` });
  } catch (error) {
    console.error(`Error al rechazar requisición ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  crearRequisicion,
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  aprobarRequisicion,
  rechazarRequisicion,
};
