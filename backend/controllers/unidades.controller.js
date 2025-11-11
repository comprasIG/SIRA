// backend/controllers/unidades.controller.js
const pool = require('../db/pool');

/**
 * @description Obtiene la lista de unidades con KPIs básicos.
 */
const getUnidades = async (req, res) => {
  const { id: usuarioId, departamento_codigo, es_superusuario } = req.usuarioSira;
  const { departamentoId } = req.query; 

  const puedeVerTodo = es_superusuario || ['FIN', 'SSD'].includes(departamento_codigo);
  
  let filtroDeptoId = null;
  if (!puedeVerTodo) {
    filtroDeptoId = req.usuarioSira.departamento_id;
  } else if (departamentoId) {
    filtroDeptoId = departamentoId;
  }
  
  try {
    let query = `
      SELECT 
        u.id, u.unidad, u.marca, u.modelo, u.no_eco, u.placas, u.serie, u.km,
        u.km_proximo_servicio, u.tipo_combustible, u.tipo_bateria, u.medidas_llantas, u.activo,
        usr.nombre AS responsable_nombre,
        d.nombre AS departamento_nombre,
        d.codigo AS departamento_codigo,
        p.id AS proyecto_id, 
        s.id AS sitio_id, 
        (SELECT COUNT(*) FROM requisiciones r WHERE r.proyecto_id = p.id AND r.status NOT IN ('ENTREGADA', 'CANCELADA')) AS requisiciones_abiertas
      FROM public.unidades u
      LEFT JOIN public.usuarios usr ON u.responsable_id = usr.id
      LEFT JOIN public.departamentos d ON usr.departamento_id = d.id
      LEFT JOIN public.proyectos p ON p.nombre = u.unidad 
      LEFT JOIN public.sitios s ON p.sitio_id = s.id
      WHERE s.nombre = 'UNIDADES'
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
  const { id: proyectoId } = req.params; 

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
      WHERE h.unidad_id = $1 -- unidad_id en la bitácora es el proyecto_id
      ORDER BY h.fecha DESC, h.kilometraje DESC;
    `;
    
    const { rows } = await pool.query(query, [proyectoId]);
    res.json(rows);

  } catch (error) {
    console.error(`Error al obtener historial de unidad ${proyectoId}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * @description Crea una nueva requisición vehicular.
 * (MODIFICADO: Ahora usa unidad_id y proyecto_id correctamente)
 */
const crearRequisicionVehicular = async (req, res) => {
  const { id: usuarioId, departamento_id } = req.usuarioSira;
  
  // ==========================================================
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  // Leemos ambos IDs del body
  // ==========================================================
  const {
    unidad_id,        // <<< El ID real de la unidad (ej: 1)
    proyecto_id,      // <<< El ID del proyecto espejo (ej: 10)
    sitio_id,
    kilometraje,
    evento_tipo_id,
    material_sku,
    descripcion,
    fecha_requerida,
  } = req.body;
  // ==========================================================
  
  const kmNum = parseInt(kilometraje, 10);

  if (!unidad_id || !proyecto_id || !sitio_id || !kmNum || !evento_tipo_id || !material_sku || !fecha_requerida) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (unidad_id, proyecto_id, etc.).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar Kilometraje contra el actual
    const kmQuery = await client.query('SELECT km FROM unidades WHERE id = $1 FOR UPDATE', [unidad_id]); // <-- Usa unidad_id
    const kmActual = kmQuery.rows[0]?.km || 0;
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }

    // 2. Buscar Material (sin cambios)
    const matQuery = await client.query(`SELECT id FROM catalogo_materiales WHERE sku = $1`, [material_sku]);
    if (matQuery.rowCount === 0) {
      throw new Error(`Material con SKU ${material_sku} no encontrado.`);
    }
    const materialId = matQuery.rows[0].id;

    // 3. Crear la Requisición (Usa proyecto_id)
    const reqQuery = await client.query(
      `INSERT INTO requisiciones 
       (usuario_id, departamento_id, sitio_id, proyecto_id, fecha_requerida, lugar_entrega, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, numero_requisicion`,
      [
        usuarioId, departamento_id, sitio_id, proyecto_id, // <-- Usa proyecto_id
        fecha_requerida, sitio_id, descripcion
      ]
    );
    const requisicion = reqQuery.rows[0];

    // 4. Insertar detalle de requisición (sin cambios)
    await client.query(
      `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
       VALUES ($1, $2, $3, $4)`,
      [requisicion.id, materialId, 1, 'Solicitud de servicio vehicular']
    );
    
    // 5. Insertar en bitácora (Usa unidad_id)
    await client.query(
      `INSERT INTO unidades_historial 
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, usuario_id, requisicion_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [
        unidad_id, // <-- CORREGIDO: Usa el ID real de la unidad
        kmNum,
        evento_tipo_id,
        `Solicitud: ${descripcion || 'N/A'}`, usuarioId, requisicion.id
      ]
    );
    
    // 6. Actualizar KM de la unidad (Usa unidad_id)
    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]); // <-- CORREGIDO

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


/**
 * @description Obtiene los datos necesarios para poblar los modales de Unidades.
 * (MODIFICADO: ahora trae TODOS los tipos de evento)
 */
const getDatosModalServicio = async (req, res) => {
  try {
    // 1. Obtenemos TODOS los tipos de evento activos
    const tiposQuery = `
      SELECT id, codigo, nombre 
      FROM unidades_evento_tipos
      WHERE activo = true
      ORDER BY nombre;
    `;

    // 2. Obtenemos los materiales genéricos (sin cambios)
    const materialesQuery = `
      SELECT nombre, sku 
      FROM catalogo_materiales
      WHERE sku IN ('SERV-VEH-PREV', 'SERV-VEH-CORR', 'LLANTA-GEN', 'COMBUS-GEN')
      AND activo = true;
    `;

    const [tiposRes, materialesRes] = await Promise.all([
      pool.query(tiposQuery),
      pool.query(materialesQuery),
    ]);

    const materialesMap = materialesRes.rows.reduce((acc, m) => {
      acc[m.sku] = m.nombre;
      return acc;
    }, {});

    res.json({
      tiposDeEvento: tiposRes.rows,
      materialesMap: materialesMap,
    });

  } catch (error) {
    console.error('Error al obtener datos para el modal de servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


/**
 * @description (¡NUEVA!) Agrega un registro manual a la bitácora sin crear requisición.
 * (MODIFICADO: Ahora usa unidad_id y proyecto_id correctamente)
 */
const agregarRegistroManualHistorial = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;
  
  // ==========================================================
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  // ==========================================================
  const {
    unidad_id,        // <<< El ID real de la unidad (ej: 1)
    // (no necesitamos proyecto_id aquí, solo el unidad_id)
    evento_tipo_id,
    kilometraje,
    descripcion,
    costo_total,
    numeros_serie
  } = req.body;
  // ==========================================================
  
  const kmNum = parseInt(kilometraje, 10);

  if (!unidad_id || !evento_tipo_id || !kmNum) {
    return res.status(400).json({ error: 'Unidad, Tipo de Evento y Kilometraje son obligatorios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Validar Kilometraje
    const kmQuery = await client.query('SELECT km FROM unidades WHERE id = $1 FOR UPDATE', [unidad_id]); // <-- Usa unidad_id
    const kmActual = kmQuery.rows[0]?.km || 0;
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }
    
    // 2. Insertar en la bitácora
    await client.query(
      `INSERT INTO unidades_historial
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, costo_total, numeros_serie, usuario_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
      [
        unidad_id, // <-- CORREGIDO
        kmNum,
        evento_tipo_id,
        descripcion,
        parseFloat(costo_total) || null,
        numeros_serie || null,
        usuarioId
      ]
    );

    // 3. Actualizar el KM maestro en la tabla de unidades
    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]); // <-- CORREGIDO

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Registro agregado a la bitácora.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al agregar registro manual a bitácora:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};


module.exports = {
  getUnidades,
  getHistorialUnidad,
  crearRequisicionVehicular,
  getDatosModalServicio,
  agregarRegistroManualHistorial, // <<< ¡NUEVA FUNCIÓN!
};