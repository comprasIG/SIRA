// backend/controllers/unidades.controller.js
const pool = require('../db/pool');

/**
 * @description Obtiene la lista de unidades con KPIs básicos.
 * Filtra por departamento del usuario, a menos que sea Superusuario,
 * Finanzas (FIN) o Compras (SSD).
 */
const getUnidades = async (req, res) => {
  const { id: usuarioId, departamento_codigo, es_superusuario } = req.usuarioSira;
  const { departamentoId } = req.query; // Para filtros del dashboard (si aplica)

  // Roles que pueden ver TODAS las unidades
  const puedeVerTodo = es_superusuario || ['FIN', 'SSD'].includes(departamento_codigo);
  
  // Determinar qué departamento filtrar
  let filtroDeptoId = null;
  if (!puedeVerTodo) {
    // Si no puede ver todo, solo ve su departamento
    filtroDeptoId = req.usuarioSira.departamento_id;
  } else if (departamentoId) {
    // Si puede ver todo y eligió un filtro, usa ese filtro
    filtroDeptoId = departamentoId;
  }
  
  try {
    let query = `
      SELECT 
        u.id, u.unidad, u.marca, u.modelo, u.no_eco, u.placas, u.serie, u.km,
        u.km_proximo_servicio, u.tipo_combustible, u.tipo_bateria, u.medidas_llantas, u.activo,
        usr.nombre AS responsable_nombre,
        d.codigo AS departamento_codigo,
        p.id AS proyecto_id, -- El ID del "proyecto espejo"
        s.id AS sitio_id, -- El ID del sitio "UNIDADES"
        (SELECT COUNT(*) FROM requisiciones r WHERE r.proyecto_id = p.id AND r.status NOT IN ('ENTREGADA', 'CANCELADA')) AS requisiciones_abiertas
      FROM public.unidades u
      JOIN public.usuarios usr ON u.responsable_id = usr.id
      JOIN public.departamentos d ON usr.departamento_id = d.id
      LEFT JOIN public.proyectos p ON p.nombre = u.unidad -- Ligamos por nombre
      LEFT JOIN public.sitios s ON p.sitio_id = s.id
      WHERE s.nombre = 'UNIDADES' -- ¡La clave! Solo traemos las ligadas al sitio UNIDADES
    `;
    
    const params = [];

    if (filtroDeptoId) {
      query += ` AND d.id = $${params.length + 1}`;
      params.push(filtroDeptoId);
    }

    query += ' ORDER BY u.no_eco ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
    
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * @description Obtiene el historial (bitácora) de una unidad específica.
 */
const getHistorialUnidad = async (req, res) => {
  const { id: unidadId } = req.params;

  try {
    const query = `
      SELECT 
        h.id, h.fecha, h.kilometraje, h.descripcion, h.costo_total, h.numeros_serie,
        e.nombre AS evento_nombre,
        u.nombre AS usuario_nombre,
        r.numero_requisicion,
        oc.numero_oc
      FROM public.unidades_historial h
      JOIN public.unidades_evento_tipos e ON h.evento_tipo_id = e.id
      LEFT JOIN public.usuarios u ON h.usuario_id = u.id
      LEFT JOIN public.requisiciones r ON h.requisicion_id = r.id
      LEFT JOIN public.ordenes_compra oc ON h.orden_compra_id = oc.id
      WHERE h.unidad_id = $1
      ORDER BY h.fecha DESC, h.kilometraje DESC;
    `;
    
    const { rows } = await pool.query(query, [unidadId]);
    res.json(rows);

  } catch (error) {
    console.error(`Error al obtener historial de unidad ${unidadId}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * @description Crea una nueva requisición vehicular.
 * Este es el endpoint que llamará el modal del frontend.
 */
const crearRequisicionVehicular = async (req, res) => {
  const { id: usuarioId, departamento_id } = req.usuarioSira;
  const {
    proyecto_id,      // ID del proyecto (que es el ID de la unidad)
    sitio_id,         // ID del sitio "UNIDADES"
    kilometraje,      // El KM actual
    evento_tipo_id,   // El ID de unidades_evento_tipos (ej. 1 para 'SERVICIO_PREV')
    material_sku,     // El SKU del material genérico (ej. 'SERV-VEH-PREV')
    descripcion,      // Notas del usuario
    fecha_requerida,
  } = req.body;

  // Validación básica
  if (!proyecto_id || !sitio_id || !kilometraje || !evento_tipo_id || !material_sku || !fecha_requerida) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Buscar el material_id usando el SKU
    const matQuery = await client.query(`SELECT id FROM catalogo_materiales WHERE sku = $1`, [material_sku]);
    if (matQuery.rowCount === 0) {
      throw new Error(`Material con SKU ${material_sku} no encontrado.`);
    }
    const materialId = matQuery.rows[0].id;

    // 2. Crear la Requisición (la clave es que usa el proyecto_id y sitio_id de la unidad)
    const reqQuery = await client.query(
      `INSERT INTO requisiciones 
       (usuario_id, departamento_id, sitio_id, proyecto_id, fecha_requerida, lugar_entrega, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, numero_requisicion`,
      [
        usuarioId,
        departamento_id,
        sitio_id,
        proyecto_id,
        fecha_requerida,
        sitio_id, // Usamos el mismo sitio_id como lugar de entrega
        descripcion
      ]
    );
    const requisicion = reqQuery.rows[0];

    // 3. Insertar el detalle de la requisición
    await client.query(
      `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
       VALUES ($1, $2, $3, $4)`,
      [requisicion.id, materialId, 1, 'Solicitud de servicio vehicular']
    );
    
    // 4. Insertar el primer registro en la bitácora (el evento de "solicitud")
    await client.query(
      `INSERT INTO unidades_historial 
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, usuario_id, requisicion_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [
        proyecto_id, // Recuerda: el proyecto_id ES el unidad_id en este flujo
        kilometraje,
        evento_tipo_id,
        `Solicitud: ${descripcion || 'N/A'}`,
        usuarioId,
        requisicion.id
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ 
      mensaje: `Requisición ${requisicion.numero_requisicion} creada y registrada en bitácora.`,
      requisicion,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear requisición vehicular:', error);
    res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
  } finally {
    client.release();
  }
};


module.exports = {
  getUnidades,
  getHistorialUnidad,
  crearRequisicionVehicular,
};