// backend/controllers/unidades.controller.js
const pool = require('../db/pool');

// ---------------------------------------------------------------------------
// Helper: resolve whether the current user can see ALL units.
// Previously this was a hardcoded ['FIN', 'SSD'] check.
// Now it reads from the departamentos_acceso_unidades table.
// ---------------------------------------------------------------------------
async function resolverAccesoTotal(client, usuarioSira) {
  if (usuarioSira.es_superusuario) return true;
  const { rows } = await client.query(
    `SELECT puede_ver_todo
     FROM departamentos_acceso_unidades
     WHERE departamento_id = $1`,
    [usuarioSira.departamento_id]
  );
  return rows.length > 0 && rows[0].puede_ver_todo === true;
}

// ---------------------------------------------------------------------------
// GET /api/unidades
// Lista de unidades filtrada por departamento del usuario (o todo si tiene acceso).
// ---------------------------------------------------------------------------
const getUnidades = async (req, res) => {
  const usuarioSira = req.usuarioSira;
  const { departamentoId, marca, status } = req.query;

  try {
    const puedeVerTodo = await resolverAccesoTotal(pool, usuarioSira);

    let filtroDeptoId = null;
    if (!puedeVerTodo) {
      filtroDeptoId = usuarioSira.departamento_id;
    } else if (departamentoId) {
      filtroDeptoId = departamentoId;
    }

    let query = `
      WITH base_unidades AS (
        SELECT
          u.id, u.unidad, u.marca, u.modelo, u.no_eco, u.placas, u.serie, u.km,
          u.km_proximo_servicio, u.tipo_combustible, u.tipo_bateria,
          u.medidas_llantas, u.activo, u.rendimiento_teorico,
          usr.nombre        AS responsable_nombre,
          d.id              AS departamento_id,
          d.nombre          AS departamento_nombre,
          d.codigo          AS departamento_codigo,
          p.id              AS proyecto_id,
          s.id              AS sitio_id,
          (
            SELECT COUNT(*)
            FROM requisiciones r
            WHERE r.proyecto_id = p.id
              AND r.status NOT IN ('ENTREGADA', 'CANCELADA')
          ) AS requisiciones_abiertas,
          -- Alertas de incidencia abiertas en esta unidad
          (
            SELECT COUNT(*)
            FROM unidades_historial h
            WHERE h.unidad_id = u.id
              AND h.es_alerta = true
              AND h.alerta_cerrada = false
          ) AS alertas_abiertas,
          -- Servicio vencido: km actual >= km del próximo servicio configurado
          CASE
            WHEN u.km_proximo_servicio IS NOT NULL
              AND u.km IS NOT NULL
              AND u.km >= u.km_proximo_servicio
            THEN true
            ELSE false
          END AS servicio_vencido
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

    if (filtroDeptoId) {
      params.push(filtroDeptoId);
      query += ` AND departamento_id = $${params.length}`;
    }

    if (marca) {
      params.push(marca);
      query += ` AND marca = $${params.length}`;
    }

    if (status === 'DISPONIBLE') {
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

// ---------------------------------------------------------------------------
// GET /api/unidades/:id/detalle
// Devuelve todos los campos de la unidad (para el modal de detalle completo).
// ---------------------------------------------------------------------------
const getUnidadDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.unidad, u.marca, u.modelo, u.no_eco, u.placas,
         u.serie, u.km, u.km_proximo_servicio, u.rendimiento_teorico,
         u.tipo_combustible, u.tipo_bateria, u.medidas_llantas, u.activo,
         u.creado_en, u.actualizado_en,
         usr.id   AS responsable_id,
         usr.nombre AS responsable_nombre,
         usr.correo AS responsable_correo,
         d.id     AS departamento_id,
         d.nombre AS departamento_nombre,
         d.codigo AS departamento_codigo
       FROM public.unidades u
       LEFT JOIN public.usuarios usr ON u.responsable_id = usr.id
       LEFT JOIN public.departamentos d ON usr.departamento_id = d.id
       WHERE u.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unidad no encontrada.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error al obtener detalle de unidad ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/unidades/:id/historial
// Devuelve la bitácora de una unidad. Soporta filtro por evento_tipo_id.
// ---------------------------------------------------------------------------
const getHistorialUnidad = async (req, res) => {
  const { id: unidadId } = req.params;
  const { eventoTipoId } = req.query;

  try {
    let query = `
      SELECT
        h.id, h.fecha, h.kilometraje, h.descripcion, h.costo_total, h.numeros_serie,
        h.es_alerta, h.alerta_cerrada, h.alerta_cerrada_en,
        e.id   AS evento_tipo_id,
        e.nombre AS evento_nombre,
        e.codigo AS evento_codigo,
        u.nombre AS usuario_nombre,
        ucierre.nombre AS alerta_cerrada_por_nombre,
        r.numero_requisicion,
        oc.numero_oc
      FROM public.unidades_historial h
      JOIN  public.unidades_evento_tipos e ON h.evento_tipo_id = e.id
      LEFT JOIN public.usuarios u          ON h.usuario_id = u.id
      LEFT JOIN public.usuarios ucierre    ON h.alerta_cerrada_por = ucierre.id
      LEFT JOIN public.requisiciones r     ON h.requisicion_id = r.id
      LEFT JOIN public.ordenes_compra oc   ON h.orden_compra_id = oc.id
      WHERE h.unidad_id = $1
    `;
    const params = [unidadId];

    if (eventoTipoId) {
      params.push(eventoTipoId);
      query += ` AND h.evento_tipo_id = $${params.length}`;
    }

    query += ' ORDER BY h.fecha DESC, h.kilometraje DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);

  } catch (error) {
    console.error(`Error al obtener historial de unidad ${unidadId}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/unidades/alertas
// Alertas de incidencia abiertas para las unidades visibles al usuario.
// ---------------------------------------------------------------------------
const getAlertasAbiertas = async (req, res) => {
  const usuarioSira = req.usuarioSira;
  try {
    const puedeVerTodo = await resolverAccesoTotal(pool, usuarioSira);

    let query = `
      SELECT
        h.id, h.fecha, h.descripcion,
        u.id   AS unidad_id,
        u.unidad, u.no_eco,
        e.nombre AS evento_nombre,
        usr.nombre AS usuario_nombre
      FROM public.unidades_historial h
      JOIN public.unidades u               ON h.unidad_id = u.id
      JOIN public.unidades_evento_tipos e  ON h.evento_tipo_id = e.id
      LEFT JOIN public.usuarios usr        ON h.usuario_id = usr.id
      LEFT JOIN public.usuarios resp       ON u.responsable_id = resp.id
      LEFT JOIN public.departamentos d     ON resp.departamento_id = d.id
      WHERE h.es_alerta = true AND h.alerta_cerrada = false
    `;
    const params = [];

    if (!puedeVerTodo) {
      params.push(usuarioSira.departamento_id);
      query += ` AND d.id = $${params.length}`;
    }

    query += ' ORDER BY h.fecha ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener alertas abiertas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/unidades/alertas/:historialId/cerrar
// Cierra una alerta de incidencia.
// ---------------------------------------------------------------------------
const cerrarAlerta = async (req, res) => {
  const { historialId } = req.params;
  const { id: usuarioId } = req.usuarioSira;
  try {
    const { rowCount } = await pool.query(
      `UPDATE public.unidades_historial
       SET alerta_cerrada     = true,
           alerta_cerrada_por = $1,
           alerta_cerrada_en  = NOW()
       WHERE id = $2 AND es_alerta = true AND alerta_cerrada = false`,
      [usuarioId, historialId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Alerta no encontrada o ya estaba cerrada.' });
    }
    res.json({ mensaje: 'Alerta cerrada correctamente.' });
  } catch (error) {
    console.error(`Error al cerrar alerta ${historialId}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/unidades/evento-tipos
// Devuelve todos los tipos de evento activos con sus banderas de configuración.
// Esto reemplaza los arreglos hardcodeados en el frontend.
// ---------------------------------------------------------------------------
const getEventoTipos = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, codigo, nombre, descripcion,
         genera_requisicion, requiere_num_serie,
         km_intervalo, tipo_combustible_aplica, material_sku
       FROM public.unidades_evento_tipos
       WHERE activo = true
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de evento:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/unidades/evento-tipos
// Permite a cualquier usuario crear un nuevo tipo de evento personalizado.
// ---------------------------------------------------------------------------
const crearEventoTipo = async (req, res) => {
  const { nombre, descripcion, requiere_num_serie } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del tipo de evento es obligatorio.' });
  }

  // Generar código automáticamente a partir del nombre
  const codigo = nombre.trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 50);

  try {
    const { rows, rowCount } = await pool.query(
      `INSERT INTO public.unidades_evento_tipos
         (codigo, nombre, descripcion, genera_requisicion, requiere_num_serie)
       VALUES ($1, $2, $3, false, $4)
       ON CONFLICT (codigo) DO NOTHING
       RETURNING id, codigo, nombre, descripcion, genera_requisicion, requiere_num_serie, km_intervalo, tipo_combustible_aplica, material_sku`,
      [codigo, nombre.trim(), descripcion?.trim() || null, requiere_num_serie === true]
    );

    if (rowCount === 0) {
      return res.status(409).json({ error: `Ya existe un tipo de evento con el código "${codigo}". Usa un nombre diferente.` });
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear tipo de evento:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/unidades/requisicion
// Crea una requisición vehicular.
// El material_sku se obtiene del evento_tipo en la DB (no del payload).
// ---------------------------------------------------------------------------
const crearRequisicionVehicular = async (req, res) => {
  const { id: usuarioId, departamento_id } = req.usuarioSira;
  const {
    unidad_id, proyecto_id, sitio_id, kilometraje,
    evento_tipo_id, descripcion, fecha_requerida,
  } = req.body;

  const kmNum = parseInt(kilometraje, 10);

  if (!unidad_id || !proyecto_id || !sitio_id || (kmNum !== 0 && !kmNum) || !evento_tipo_id || !fecha_requerida) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (unidad_id, proyecto_id, sitio_id, kilometraje, evento_tipo_id, fecha_requerida).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validar km actual
    const kmQuery = await client.query('SELECT km FROM unidades WHERE id = $1 FOR UPDATE', [unidad_id]);
    const kmActual = kmQuery.rows[0]?.km || 0;
    if (kmNum < kmActual) {
      throw new Error(`El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`);
    }

    // Obtener datos del tipo de evento (material_sku viene de la BD, no del payload)
    const tipoQuery = await client.query(
      `SELECT id, nombre, material_sku, genera_requisicion, km_intervalo
       FROM public.unidades_evento_tipos
       WHERE id = $1 AND activo = true`,
      [evento_tipo_id]
    );
    if (tipoQuery.rowCount === 0) {
      throw new Error(`Tipo de evento con id ${evento_tipo_id} no encontrado o inactivo.`);
    }
    const tipoEvento = tipoQuery.rows[0];

    if (!tipoEvento.genera_requisicion) {
      throw new Error(`El tipo de evento "${tipoEvento.nombre}" no genera requisición. Usa el registro manual.`);
    }

    if (!tipoEvento.material_sku) {
      throw new Error(`El tipo de evento "${tipoEvento.nombre}" no tiene un material (SKU) configurado. Contacta al administrador.`);
    }

    // Buscar material por SKU
    const matQuery = await client.query(
      `SELECT id FROM catalogo_materiales WHERE sku = $1 AND activo = true`,
      [tipoEvento.material_sku]
    );
    if (matQuery.rowCount === 0) {
      throw new Error(`Material con SKU "${tipoEvento.material_sku}" no encontrado en el catálogo.`);
    }
    const materialId = matQuery.rows[0].id;

    // Crear requisición
    const reqQuery = await client.query(
      `INSERT INTO requisiciones
         (usuario_id, departamento_id, sitio_id, proyecto_id, fecha_requerida, lugar_entrega, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, numero_requisicion`,
      [usuarioId, departamento_id, sitio_id, proyecto_id, fecha_requerida, sitio_id, descripcion || null]
    );
    const requisicion = reqQuery.rows[0];

    // Detalle de la requisición
    await client.query(
      `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
       VALUES ($1, $2, 1, $3)`,
      [requisicion.id, materialId, `Servicio: ${tipoEvento.nombre}`]
    );

    // Registrar en bitácora
    await client.query(
      `INSERT INTO unidades_historial
         (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, usuario_id, requisicion_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [unidad_id, kmNum, evento_tipo_id, descripcion || `Solicitud: ${tipoEvento.nombre}`, usuarioId, requisicion.id]
    );

    // Actualizar km y km_proximo_servicio si el tipo tiene km_intervalo
    if (tipoEvento.km_intervalo) {
      await client.query(
        `UPDATE unidades SET km = $1, km_proximo_servicio = $2 WHERE id = $3`,
        [kmNum, kmNum + tipoEvento.km_intervalo, unidad_id]
      );
    } else {
      await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]);
    }

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

// ---------------------------------------------------------------------------
// POST /api/unidades/historial/manual
// Agrega un registro manual a la bitácora sin generar requisición.
// Soporta es_alerta para incidencias.
// ---------------------------------------------------------------------------
const agregarRegistroManualHistorial = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;
  const {
    unidad_id, evento_tipo_id, kilometraje,
    descripcion, costo_total, numeros_serie, es_alerta,
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

    // Verificar que el tipo de evento NO genere requisición
    const tipoQuery = await client.query(
      `SELECT genera_requisicion, nombre FROM unidades_evento_tipos WHERE id = $1`,
      [evento_tipo_id]
    );
    if (tipoQuery.rows[0]?.genera_requisicion) {
      throw new Error(`El tipo de evento "${tipoQuery.rows[0].nombre}" genera una requisición. Usa "Solicitar Servicio".`);
    }

    const esAlertaBool = es_alerta === true || es_alerta === 'true';

    await client.query(
      `INSERT INTO unidades_historial
         (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion,
          costo_total, numeros_serie, usuario_id, es_alerta)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)`,
      [
        unidad_id, kmNum, evento_tipo_id,
        descripcion || null,
        parseFloat(costo_total) || null,
        numeros_serie || null,
        usuarioId,
        esAlertaBool,
      ]
    );

    await client.query('UPDATE unidades SET km = $1 WHERE id = $2', [kmNum, unidad_id]);

    await client.query('COMMIT');
    res.status(201).json({
      mensaje: esAlertaBool
        ? 'Incidencia reportada y registrada en bitácora.'
        : 'Registro agregado a la bitácora.',
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al agregar registro manual a bitácora:', error);
    res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// GET /api/unidades/datos-filtros
// Opciones para los filtros del dashboard (marcas + departamentos con unidades).
// ---------------------------------------------------------------------------
const getDatosParaFiltros = async (req, res) => {
  try {
    const [marcasRes, deptosRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT u.marca
         FROM unidades u
         JOIN proyectos p ON u.unidad = p.nombre
         JOIN sitios s    ON p.sitio_id = s.id
         WHERE s.nombre = 'UNIDADES' AND u.marca IS NOT NULL
         ORDER BY u.marca ASC`
      ),
      pool.query(
        `SELECT DISTINCT d.id, d.nombre, d.codigo
         FROM departamentos d
         JOIN usuarios usr   ON d.id = usr.departamento_id
         JOIN unidades u     ON usr.id = u.responsable_id
         JOIN proyectos p    ON u.unidad = p.nombre
         JOIN sitios s       ON p.sitio_id = s.id
         WHERE s.nombre = 'UNIDADES'
         ORDER BY d.nombre ASC`
      ),
    ]);

    res.json({
      marcas: marcasRes.rows.map(r => r.marca),
      departamentos: deptosRes.rows,
    });
  } catch (error) {
    console.error('Error al obtener datos para filtros de unidades:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getUnidades,
  getUnidadDetalle,
  getHistorialUnidad,
  getAlertasAbiertas,
  cerrarAlerta,
  getEventoTipos,
  crearEventoTipo,
  crearRequisicionVehicular,
  agregarRegistroManualHistorial,
  getDatosParaFiltros,
};
