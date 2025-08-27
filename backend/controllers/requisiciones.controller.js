//C:\SIRA\backend\controllers\requisiciones.controller.js
/*
const pool = require('../db/pool');

const crearRequisicion = async (req, res) => {
  let client;
  try {
    const { proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, materiales, adjuntos } = req.body;

    if (!proyecto_id || !sitio_id || !fecha_requerida || !lugar_entrega) {
      return res.status(400).json({ error: 'Faltan campos obligatorios en la requisición.' });
    }

    if (!Array.isArray(materiales) || materiales.length === 0) {
      return res.status(400).json({ error: 'Debes agregar al menos un material a la requisición.' });
    }

    for (const mat of materiales) {
      if (!mat.material_id || typeof mat.cantidad !== 'number' || mat.cantidad <= 0) {
        return res.status(400).json({ error: 'Cada material debe tener material_id y una cantidad > 0.' });
      }
    }

    if (adjuntos && !Array.isArray(adjuntos)) {
      return res.status(400).json({ error: 'El campo adjuntos debe ser un array si se incluye.' });
    }

    //const correoGoogle = "compras.biogas@gmail.com"; // Temporal
    const correoGoogle = req?.firebaseUser?.email;
    if (!correoGoogle) {
    return res.status(401).json({ error: 'No se pudo obtener el correo del usuario autenticado.' });
    }




    // Validación previa a la transacción (usuario, proyecto, sitio)
    const userResult = await pool.query(
      'SELECT id, departamento_id FROM usuarios WHERE correo_google = $1',
      [correoGoogle]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no autorizado o no registrado en sistema.' });
    }
    const usuario_id = userResult.rows[0].id;
    const departamento_id = userResult.rows[0].departamento_id;

    const proyectoResult = await pool.query(
      'SELECT id FROM proyectos WHERE id = $1',
      [proyecto_id]
    );
    if (proyectoResult.rows.length === 0) {
      return res.status(400).json({ error: 'El proyecto seleccionado no existe.' });
    }

    const sitioResult = await pool.query(
      'SELECT id FROM sitios WHERE id = $1',
      [sitio_id]
    );
    if (sitioResult.rows.length === 0) {
      return res.status(400).json({ error: 'El sitio seleccionado no existe.' });
    }

// 1. Obtener los material_id únicos del array de materiales
const materialesIds = [...new Set(materiales.map(mat => mat.material_id))];

// 2. Consultar la base para ver cuáles existen
const matResult = await pool.query(
  `SELECT id FROM catalogo_materiales WHERE id = ANY($1)`,
  [materialesIds]
);

const encontrados = matResult.rows.map(row => row.id);

// 3. Verificar si falta alguno
const faltantes = materialesIds.filter(id => !encontrados.includes(id));
if (faltantes.length > 0) {
  return res.status(400).json({
    error: 'Uno o más materiales no existen en el catálogo.',
    materiales_faltantes: faltantes
  });
}


    // -------------------------
    // INICIO DE TRANSACCIÓN
    // -------------------------
    client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar la requisición principal
      const insertRequisicionQuery = `
        INSERT INTO requisiciones (
          usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, numero_requisicion
      `;
      const insertRequisicionValues = [
        usuario_id,
        departamento_id,
        proyecto_id,
        sitio_id,
        fecha_requerida,
        lugar_entrega,
        comentario || null
      ];
      const requisicionResult = await client.query(insertRequisicionQuery, insertRequisicionValues);

      if (requisicionResult.rows.length === 0) {
        throw new Error('No se pudo crear la requisición.');
      }

      const requisicion_id = requisicionResult.rows[0].id;
      const numero_requisicion = requisicionResult.rows[0].numero_requisicion;

      // Insertar materiales
      for (const mat of materiales) {
        await client.query(
          `INSERT INTO requisiciones_detalle (
            requisicion_id, material_id, cantidad, comentario
          ) VALUES ($1, $2, $3, $4)`,
          [
            requisicion_id,
            mat.material_id,
            mat.cantidad,
            mat.comentario || null
          ]
        );
      }

      // Insertar adjuntos (si hay)
      if (Array.isArray(adjuntos) && adjuntos.length > 0) {
        for (const adjunto of adjuntos) {
          await client.query(
            `INSERT INTO requisiciones_adjuntos (
              requisicion_id, nombre_archivo, ruta_archivo
            ) VALUES ($1, $2, $3)`,
            [
              requisicion_id,
              adjunto.nombre_archivo,
              adjunto.ruta_archivo
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Respuesta de éxito solo si todo salió bien
      return res.status(200).json({
        mensaje: 'Requisición creada exitosamente.',
        requisicion_id,
        numero_requisicion,
        usuario_id,
        departamento_id
      });
    } catch (txError) {
      if (client) await client.query('ROLLBACK');
      console.error('Error en la transacción:', txError);
      return res.status(500).json({ error: 'Error al guardar la requisición (transacción revertida).' });
    } finally {
      if (client) client.release();
    }

  } catch (error) {
    console.error('Error al crear requisición:', error);
    return res.status(500).json({ error: 'Error interno al crear requisición.' });
  }
};

module.exports = {
  crearRequisicion,
};
*/

// C:\SIRA\backend\controllers\requisiciones.controller.js

const pool = require('../db/pool');

/**
 * Obtiene las requisiciones pendientes de aprobación para el departamento del usuario logueado.
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
const getRequisicionesPorAprobar = async (req, res) => {
  // Obtenemos el ID de departamento del usuario que fue previamente cargado por el middleware.
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
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
const getRequisicionDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    // Consulta para los datos principales de la requisición
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

    // Consulta para los materiales de la requisición
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
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
const aprobarRequisicion = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener datos necesarios para el RFQ code
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

    // 2. Generar el RFQ Code
    const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
    const consecutivo = consecutivoResult.rows[0].consecutivo;
    const numReq = numero_requisicion.split('_')[1] || '';
    const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;

    // 3. Actualizar la requisición
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
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
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


// ... (tu función crearRequisicion existente va aquí)
const crearRequisicion = async (req, res) => {
  // ... tu código existente
};


module.exports = {
  crearRequisicion, // Ya la tenías
  getRequisicionesPorAprobar, // Nueva
  getRequisicionDetalle, // Nueva
  aprobarRequisicion, // Nueva
  rechazarRequisicion, // Nueva
};