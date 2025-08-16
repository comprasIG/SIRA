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

    const correoGoogle = "compras.biogas@gmail.com"; // Temporal

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
