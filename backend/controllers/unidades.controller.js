// backend/controllers/unidades.controller.js
const pool = require('../db/pool');

/**
 * @description (MODIFICADO) Obtiene la lista de unidades, ahora con filtros avanzados.
 * Filtra por departamento del usuario (a menos que sea admin).
 * Acepta filtros por query param: departamentoId, marca, status.
 */
const getUnidades = async (req, res) => {
  const { id: usuarioId, departamento_codigo, es_superusuario, departamento_id } = req.usuarioSira;
  
  // --- Lógica de Filtros ---
  const { departamentoId, marca, status } = req.query;
  
  const puedeVerTodo = es_superusuario || ['FIN', 'SSD'].includes(departamento_codigo);
  
  let filtroDeptoId = null;
  if (!puedeVerTodo) {
    // Si no puede ver todo, SÓLO ve su departamento
    filtroDeptoId = departamento_id;
  } else if (departamentoId) {
    // Si puede ver todo y eligió un filtro, usa ese filtro
    filtroDeptoId = departamentoId;
  }
  
  try {
    // Usamos un Common Table Expression (CTE) para poder filtrar por el
    // campo calculado 'requisiciones_abiertas'.
    let query = `
      WITH base_unidades AS (
        SELECT 
          u.id, u.unidad, u.marca, u.modelo, u.no_eco, u.placas, u.serie, u.km,
          u.km_proximo_servicio, u.tipo_combustible, u.tipo_bateria, u.medidas_llantas, u.activo,
          usr.nombre AS responsable_nombre,
          d.id AS departamento_id, -- ID real para el filtro
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
        WHERE s.nombre = 'UNIDADES' AND u.activo = true
      )
      SELECT * FROM base_unidades
      WHERE 1 = 1
    `;
    
    const params = [];

    // Filtro 1: Departamento (ID)
    if (filtroDeptoId) {
      params.push(filtroDeptoId);
      query += ` AND departamento_id = $${params.length}`;
    }

    // Filtro 2: Marca (String)
    if (marca) {
      params.push(marca);
      query += ` AND marca = $${params.length}`;
    }

    // Filtro 3: Status (Calculado)
    if (status === 'DISPONIBLE') {
      // CAST es necesario porque el COUNT() devuelve un BIGINT (que se lee como string)
      query += ` AND CAST(requisiciones_abiertas AS INTEGER) = 0`;
    } else if (status === 'EN_SERVICIO') {
      query += ` AND CAST(requisiciones_abiertas AS INTEGER) > 0`;
    }

    query += ' ORDER BY no_eco ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
    
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * @description Obtiene el historial (bitácora) de una unidad específica.
 * (Corregido para usar unidad_id real)
 */
const getHistorialUnidad = async (req, res) => {
  const { id: unidadId } = req.params; // Este es el unidad.id real

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
 * (Corregido para usar unidad_id y proyecto_id)
 */
const crearRequisicionVehicular = async (req, res) => {
  const { id: usuarioId, departamento_id } = req.usuarioSira;
  const {
    unidad_id, proyecto_id, sitio_id, kilometraje, 
    evento_tipo_id, material_sku, descripcion, fecha_requerida,
  } = req.body;
  
  const kmNum = parseInt(kilometraje, 10);

  if (!unidad_id || !proyecto_id || !sitio_id || (kmNum !== 0 && !kmNum) || !evento_tipo_id || !material_sku || !fecha_requerida) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (unidad_id, proyecto_id, etc.).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const kmQuery = await client.query('SELECT km FROM unidades WHERE id = $1 FOR UPDATE', [unidad_id]);
    const kmActual = kmQuery.rows[0]?.km || 0;
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }

    const matQuery = await client.query(`SELECT id FROM catalogo_materiales WHERE sku = $1`, [material_sku]);
    if (matQuery.rowCount === 0) throw new Error(`Material con SKU ${material_sku} no encontrado.`);
    const materialId = matQuery.rows[0].id;

    const reqQuery = await client.query(
      `INSERT INTO requisiciones 
       (usuario_id, departamento_id, sitio_id, proyecto_id, fecha_requerida, lugar_entrega, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, numero_requisicion`,
      [
        usuarioId, departamento_id, sitio_id, proyecto_id,
        fecha_requerida, sitio_id, descripcion
      ]
    );
    const requisicion = reqQuery.rows[0];

    await client.query(
      `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
       VALUES ($1, $2, $3, $4)`,
      [requisicion.id, materialId, 1, 'Solicitud de servicio vehicular']
    );
    
    await client.query(
      `INSERT INTO unidades_historial 
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, usuario_id, requisicion_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [
        unidad_id, kmNum, evento_tipo_id,
        `Solicitud: ${descripcion || 'N/A'}`, usuarioId, requisicion.id
      ]
    );
    
    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]);

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
 */
const getDatosModalServicio = async (req, res) => {
  try {
    const tiposQuery = `
      SELECT id, codigo, nombre 
      FROM unidades_evento_tipos
      WHERE activo = true
      ORDER BY nombre;
    `;
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
 * @description Agrega un registro manual a la bitácora sin crear requisición.
 */
const agregarRegistroManualHistorial = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;
  const {
    unidad_id, evento_tipo_id, kilometraje,
    descripcion, costo_total, numeros_serie
  } = req.body;
  
  const kmNum = parseInt(kilometraje, 10);

  if (!unidad_id || !evento_tipo_id || (kmNum !== 0 && !kmNum)) {
    return res.status(400).json({ error: 'Unidad, Tipo de Evento y Kilometraje son obligatorios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const kmQuery = await client.query('SELECT km FROM unidades WHERE id = $1 FOR UPDATE', [unidad_id]);
    const kmActual = kmQuery.rows[0]?.km || 0;
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }
    
    await client.query(
      `INSERT INTO unidades_historial
       (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, costo_total, numeros_serie, usuario_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
      [
        unidad_id, kmNum, evento_tipo_id, descripcion,
        parseFloat(costo_total) || null,
        numeros_serie || null,
        usuarioId
      ]
    );

    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]);

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Registro agregado a la bitácora.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al agregar registro manual a bitácora:', error);
    res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
  } finally {
    client.release();
  }
};

// ===============================================
// --- ¡NUEVA FUNCIÓN! ---
// ===============================================
/**
 * @description Obtiene las listas de Departamentos y Marcas
 * que SÍ tienen unidades asignadas, para poblar los filtros.
 */
const getDatosParaFiltros = async (req, res) => {
  try {
    // 1. Obtener Marcas (solo de unidades en el sitio 'UNIDADES')
    const marcasQuery = `
      SELECT DISTINCT u.marca 
      FROM unidades u
      JOIN proyectos p ON u.unidad = p.nombre
      JOIN sitios s ON p.sitio_id = s.id
      WHERE s.nombre = 'UNIDADES' AND u.marca IS NOT NULL
      ORDER BY u.marca ASC;
    `;
    
    // 2. Obtener Departamentos (solo de usuarios que tienen unidades asignadas)
    const deptosQuery = `
      SELECT DISTINCT d.id, d.nombre, d.codigo 
      FROM departamentos d
      JOIN usuarios usr ON d.id = usr.departamento_id
      JOIN unidades u ON usr.id = u.responsable_id
      JOIN proyectos p ON u.unidad = p.nombre
      JOIN sitios s ON p.sitio_id = s.id
      WHERE s.nombre = 'UNIDADES'
      ORDER BY d.nombre ASC;
    `;

    const [marcasRes, deptosRes] = await Promise.all([
      pool.query(marcasQuery),
      pool.query(deptosQuery)
    ]);
    
    res.json({
      marcas: marcasRes.rows.map(r => r.marca), // Array de strings
      departamentos: deptosRes.rows, // Array de objetos {id, nombre, codigo}
    });

  } catch (error) {
    console.error('Error al obtener datos para filtros de unidades:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
// ===============================================


module.exports = {
  getUnidades,
  getHistorialUnidad,
  crearRequisicionVehicular,
  getDatosModalServicio,
  agregarRegistroManualHistorial,
  getDatosParaFiltros, // <<< ¡NUEVA FUNCIÓN EXPORTADA!
};