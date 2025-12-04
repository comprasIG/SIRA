// C:\SIRA\backend\controllers\proyectos\g_proj.controller.js
/**
 * CONTROLADOR: Generación de Proyectos (G_PROJ)
 * - Crear nuevo proyecto
 */

const pool = require('../../db/pool');

const crearProyecto = async (req, res) => {
  try {
    let { responsable_id, cliente_id, sitio_id, nombre, descripcion } = req.body;

    // Normalizaciones
    responsable_id = Number(responsable_id);
    sitio_id = Number(sitio_id);
    cliente_id = cliente_id ? Number(cliente_id) : null;

    nombre = typeof nombre === 'string' ? nombre.trim() : '';
    descripcion = typeof descripcion === 'string' ? descripcion.trim() : '';

    // Validaciones mínimas
    if (!responsable_id || !sitio_id || !nombre || !descripcion) {
      return res.status(400).json({
        error:
          'Faltan datos obligatorios: responsable, sitio, nombre y descripción.',
      });
    }

    // Validar responsable (usuario)
    const respResult = await pool.query(
      `SELECT id FROM public.usuarios WHERE id = $1`,
      [responsable_id]
    );
    if (respResult.rowCount === 0) {
      return res.status(400).json({ error: 'Responsable inválido.' });
    }

    // Validar sitio y obtener cliente asociado
    const sitioResult = await pool.query(
      `SELECT s.id, s.cliente 
         FROM public.sitios s
        WHERE s.id = $1`,
      [sitio_id]
    );
    if (sitioResult.rowCount === 0) {
      return res.status(400).json({ error: 'Sitio inválido.' });
    }

    const sitioClienteId = sitioResult.rows[0].cliente;

    // Respetamos la lógica del DDL (cliente viene del sitio) 
    const clienteFinalId = sitioClienteId;

    const insertResult = await pool.query(
      `
      INSERT INTO public.proyectos
        (nombre, descripcion, responsable_id, sitio_id, cliente_id, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, nombre;
      `,
      [nombre, descripcion, responsable_id, sitio_id, clienteFinalId]
    );

    const proyecto = insertResult.rows[0];

    return res.status(201).json({
      mensaje: 'Proyecto creado correctamente.',
      proyecto,
    });
  } catch (error) {
    console.error('Error al crear proyecto (G_PROJ):', error);
    return res.status(500).json({
      error: error.message || 'Error interno del servidor.',
    });
  }
};

module.exports = {
  crearProyecto,
};
