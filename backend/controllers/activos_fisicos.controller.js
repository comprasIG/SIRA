// backend/controllers/activos_fisicos.controller.js
'use strict';

const pool = require('../db/pool');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildSearchWhere(search) {
  if (!search) return '';
  return `
    AND (
      a.sku       ILIKE $SEARCH_PH
      OR a.nombre ILIKE $SEARCH_PH
      OR a.codigo ILIKE $SEARCH_PH
      OR a.numero_serie ILIKE $SEARCH_PH
    )`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGOS — CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════════════

const listCategorias = async (req, res) => {
  try {
    const { activo } = req.query;
    let sql = 'SELECT * FROM public.catalogo_activo_fisico_categorias';
    const params = [];
    if (activo !== undefined) {
      sql += ' WHERE activo = $1';
      params.push(activo === 'true');
    }
    sql += ' ORDER BY nombre ASC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('listCategorias:', err);
    res.status(500).json({ error: 'Error al listar categorías.' });
  }
};

const createCategoria = async (req, res) => {
  try {
    const { clave, nombre, descripcion, activo = true } = req.body;
    if (!clave?.trim() || !nombre?.trim()) {
      return res.status(400).json({ error: 'Clave y nombre son obligatorios.' });
    }
    const result = await pool.query(
      `INSERT INTO public.catalogo_activo_fisico_categorias (clave, nombre, descripcion, activo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [clave.trim().toUpperCase(), nombre.trim(), descripcion || null, activo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createCategoria:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave o nombre ya existe.' });
    res.status(500).json({ error: 'Error al crear categoría.' });
  }
};

const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { clave, nombre, descripcion, activo } = req.body;
    const result = await pool.query(
      `UPDATE public.catalogo_activo_fisico_categorias
       SET clave=$1, nombre=$2, descripcion=$3, activo=$4
       WHERE id=$5 RETURNING *`,
      [clave?.trim().toUpperCase(), nombre?.trim(), descripcion || null, activo, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateCategoria:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave o nombre ya existe.' });
    res.status(500).json({ error: 'Error al actualizar categoría.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGOS — TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

const listTipos = async (req, res) => {
  try {
    const { categoria_id, activo } = req.query;
    const params = [];
    const conditions = [];
    if (categoria_id) { params.push(categoria_id); conditions.push(`t.categoria_id = $${params.length}`); }
    if (activo !== undefined) { params.push(activo === 'true'); conditions.push(`t.activo = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await pool.query(
      `SELECT t.*, c.nombre AS categoria_nombre, c.clave AS categoria_clave
       FROM public.catalogo_activo_fisico_tipos t
       JOIN public.catalogo_activo_fisico_categorias c ON c.id = t.categoria_id
       ${where}
       ORDER BY c.nombre, t.nombre`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listTipos:', err);
    res.status(500).json({ error: 'Error al listar tipos.' });
  }
};

const createTipo = async (req, res) => {
  try {
    const { categoria_id, clave, nombre, descripcion, activo = true } = req.body;
    if (!categoria_id || !clave?.trim() || !nombre?.trim()) {
      return res.status(400).json({ error: 'Categoría, clave y nombre son obligatorios.' });
    }
    const result = await pool.query(
      `INSERT INTO public.catalogo_activo_fisico_tipos (categoria_id, clave, nombre, descripcion, activo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [categoria_id, clave.trim().toUpperCase(), nombre.trim(), descripcion || null, activo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createTipo:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave o nombre ya existe en esa categoría.' });
    res.status(500).json({ error: 'Error al crear tipo.' });
  }
};

const updateTipo = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoria_id, clave, nombre, descripcion, activo } = req.body;
    const result = await pool.query(
      `UPDATE public.catalogo_activo_fisico_tipos
       SET categoria_id=$1, clave=$2, nombre=$3, descripcion=$4, activo=$5
       WHERE id=$6 RETURNING *`,
      [categoria_id, clave?.trim().toUpperCase(), nombre?.trim(), descripcion || null, activo, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tipo no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateTipo:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave o nombre ya existe en esa categoría.' });
    res.status(500).json({ error: 'Error al actualizar tipo.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGOS — UBICACIONES
// ═══════════════════════════════════════════════════════════════════════════════

const listUbicaciones = async (req, res) => {
  try {
    const { activo } = req.query;
    const params = [];
    let where = '';
    if (activo !== undefined) {
      params.push(activo === 'true');
      where = `WHERE u.activo = $1`;
    }
    const result = await pool.query(
      `SELECT u.*, p.nombre AS parent_nombre
       FROM public.catalogo_activo_fisico_ubicaciones u
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones p ON p.id = u.parent_id
       ${where}
       ORDER BY u.nombre`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listUbicaciones:', err);
    res.status(500).json({ error: 'Error al listar ubicaciones.' });
  }
};

const createUbicacion = async (req, res) => {
  try {
    const { clave, nombre, descripcion, parent_id = null, activo = true } = req.body;
    if (!clave?.trim() || !nombre?.trim()) {
      return res.status(400).json({ error: 'Clave y nombre son obligatorios.' });
    }
    const result = await pool.query(
      `INSERT INTO public.catalogo_activo_fisico_ubicaciones (clave, nombre, descripcion, parent_id, activo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [clave.trim().toUpperCase(), nombre.trim(), descripcion || null, parent_id || null, activo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createUbicacion:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave ya existe.' });
    res.status(500).json({ error: 'Error al crear ubicación.' });
  }
};

const updateUbicacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { clave, nombre, descripcion, parent_id, activo } = req.body;
    const result = await pool.query(
      `UPDATE public.catalogo_activo_fisico_ubicaciones
       SET clave=$1, nombre=$2, descripcion=$3, parent_id=$4, activo=$5
       WHERE id=$6 RETURNING *`,
      [clave?.trim().toUpperCase(), nombre?.trim(), descripcion || null, parent_id || null, activo, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ubicación no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateUbicacion:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'La clave ya existe.' });
    res.status(500).json({ error: 'Error al actualizar ubicación.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVOS — LISTADO
// ═══════════════════════════════════════════════════════════════════════════════

const getPendientesCount = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.activos_fisicos
       WHERE empleado_responsable_actual_id IS NULL
         AND estatus = 'ACTIVO'
         AND activo = true`
    );
    res.json({ total: result.rows[0].total });
  } catch (err) {
    console.error('getPendientesCount:', err);
    res.status(500).json({ error: 'Error al contar pendientes.' });
  }
};

const listPendientes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         a.id, a.sku, a.codigo, a.nombre, a.marca, a.modelo, a.numero_serie,
         a.fecha_compra, a.costo_compra, a.moneda,
         a.estatus, a.activo, a.creado_en,
         a.categoria_id,  cat.nombre AS categoria_nombre,
         a.tipo_id,       tip.nombre AS tipo_nombre,
         a.ubicacion_actual_id,
         ub.nombre AS ubicacion_nombre
       FROM public.activos_fisicos a
       LEFT JOIN public.catalogo_activo_fisico_categorias cat ON cat.id = a.categoria_id
       LEFT JOIN public.catalogo_activo_fisico_tipos       tip ON tip.id = a.tipo_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones ub  ON ub.id  = a.ubicacion_actual_id
       WHERE a.empleado_responsable_actual_id IS NULL
         AND a.estatus = 'ACTIVO'
         AND a.activo = true
       ORDER BY a.creado_en DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listPendientes:', err);
    res.status(500).json({ error: 'Error al listar pendientes.' });
  }
};

const listActivos = async (req, res) => {
  try {
    const { search, categoria_id, estatus, ubicacion_id, sin_asignar } = req.query;
    const params = [];
    const conditions = ['1=1'];

    if (search) {
      params.push(`%${search}%`);
      const ph = `$${params.length}`;
      conditions.push(`(a.sku ILIKE ${ph} OR a.nombre ILIKE ${ph} OR a.codigo ILIKE ${ph} OR a.numero_serie ILIKE ${ph})`);
    }
    if (categoria_id)               { params.push(categoria_id); conditions.push(`a.categoria_id = $${params.length}`); }
    if (estatus)                    { params.push(estatus);      conditions.push(`a.estatus = $${params.length}`); }
    if (ubicacion_id)               { params.push(ubicacion_id); conditions.push(`a.ubicacion_actual_id = $${params.length}`); }
    if (sin_asignar === 'true')     { conditions.push(`a.empleado_responsable_actual_id IS NULL AND a.estatus = 'ACTIVO' AND a.activo = true`); }

    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
         a.id, a.sku, a.codigo, a.nombre, a.marca, a.modelo, a.numero_serie,
         a.fecha_compra, a.costo_compra, a.moneda,
         a.estatus, a.activo, a.proveedor_id, a.creado_en,
         a.categoria_id,  cat.nombre  AS categoria_nombre,
         a.tipo_id,       tip.nombre  AS tipo_nombre,
         a.empleado_responsable_actual_id,
         COALESCE(e.nombre_completo, TRIM(e.nombre || ' ' || e.apellido_paterno)) AS responsable_nombre,
         a.ubicacion_actual_id,
         ub.nombre AS ubicacion_nombre,
         a.ultimo_movimiento_id,
         a.origen_oc_detalle_id
       FROM public.activos_fisicos a
       LEFT JOIN public.catalogo_activo_fisico_categorias cat ON cat.id = a.categoria_id
       LEFT JOIN public.catalogo_activo_fisico_tipos       tip ON tip.id = a.tipo_id
       LEFT JOIN public.empleados                          e   ON e.id   = a.empleado_responsable_actual_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones ub  ON ub.id  = a.ubicacion_actual_id
       WHERE ${where}
       ORDER BY a.creado_en DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listActivos:', err);
    res.status(500).json({ error: 'Error al listar activos físicos.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVOS — CREAR
// ═══════════════════════════════════════════════════════════════════════════════

const createActivo = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      categoria_id, tipo_id, nombre, codigo, marca, modelo, numero_serie,
      detalle_tecnico, fecha_compra, costo_compra, moneda, proveedor_id,
      // Alta inicial (opcionales)
      empleado_responsable_nuevo_id, ubicacion_nueva_id, observaciones_alta,
    } = req.body;

    if (!categoria_id || !tipo_id || !nombre?.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Categoría, tipo y nombre son obligatorios.' });
    }

    // 1) Crear el activo (SKU generado por trigger)
    const activoRes = await client.query(
      `INSERT INTO public.activos_fisicos
         (categoria_id, tipo_id, nombre, codigo, marca, modelo, numero_serie,
          detalle_tecnico, fecha_compra, costo_compra, moneda, proveedor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        categoria_id, tipo_id, nombre.trim(),
        codigo || null, marca || null, modelo || null, numero_serie || null,
        detalle_tecnico || null,
        fecha_compra || null,
        costo_compra != null && costo_compra !== '' ? Number(costo_compra) : null,
        moneda || null,
        proveedor_id || null,
      ]
    );
    const activo = activoRes.rows[0];

    // 2) Si viene asignación inicial, registrar movimiento ALTA
    if (empleado_responsable_nuevo_id || ubicacion_nueva_id) {
      await client.query(
        `INSERT INTO public.activos_fisicos_movimientos
           (activo_fisico_id, tipo_movimiento, usuario_id,
            empleado_responsable_nuevo_id, ubicacion_nueva_id, observaciones)
         VALUES ($1,'ALTA',$2,$3,$4,$5)`,
        [
          activo.id,
          req.siraUser?.id ?? req.user?.uid ?? null,
          empleado_responsable_nuevo_id || null,
          ubicacion_nueva_id || null,
          observaciones_alta || null,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(activo);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createActivo:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'El número de serie ya existe.' });
    res.status(500).json({ error: err.message || 'Error al crear activo.' });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVOS — ACTUALIZAR DATOS BÁSICOS
// ═══════════════════════════════════════════════════════════════════════════════

const updateActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre, codigo, marca, modelo, numero_serie, detalle_tecnico,
      fecha_compra, costo_compra, moneda, proveedor_id,
    } = req.body;

    const result = await pool.query(
      `UPDATE public.activos_fisicos
       SET nombre=$1, codigo=$2, marca=$3, modelo=$4, numero_serie=$5,
           detalle_tecnico=$6, fecha_compra=$7, costo_compra=$8, moneda=$9, proveedor_id=$10
       WHERE id=$11 RETURNING *`,
      [
        nombre?.trim(), codigo || null, marca || null, modelo || null,
        numero_serie || null, detalle_tecnico || null,
        fecha_compra || null,
        costo_compra != null && costo_compra !== '' ? Number(costo_compra) : null,
        moneda || null, proveedor_id || null,
        id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Activo no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateActivo:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'El número de serie ya existe.' });
    res.status(500).json({ error: 'Error al actualizar activo.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOVIMIENTOS — ACTIVO ESPECÍFICO
// ═══════════════════════════════════════════════════════════════════════════════

const listMovimientosActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         m.id, m.consecutivo, m.tipo_movimiento, m.fecha_movimiento,
         m.observaciones, m.estado, m.motivo_anulacion,
         m.empleado_responsable_anterior_id,
         m.empleado_responsable_nuevo_id,
         m.ubicacion_anterior_id,
         m.ubicacion_nueva_id,
         COALESCE(era.nombre_completo, TRIM(era.nombre||' '||era.apellido_paterno)) AS responsable_anterior,
         COALESCE(ern.nombre_completo, TRIM(ern.nombre||' '||ern.apellido_paterno)) AS responsable_nuevo,
         ua.nombre AS ubicacion_anterior,
         un.nombre AS ubicacion_nueva,
         u.email   AS usuario_email
       FROM public.activos_fisicos_movimientos m
       LEFT JOIN public.empleados era ON era.id = m.empleado_responsable_anterior_id
       LEFT JOIN public.empleados ern ON ern.id = m.empleado_responsable_nuevo_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones ua ON ua.id = m.ubicacion_anterior_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones un ON un.id = m.ubicacion_nueva_id
       LEFT JOIN public.usuarios u ON u.id = m.usuario_id
       WHERE m.activo_fisico_id = $1
       ORDER BY m.consecutivo ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listMovimientosActivo:', err);
    res.status(500).json({ error: 'Error al obtener movimientos.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOVIMIENTOS — CREAR
// ═══════════════════════════════════════════════════════════════════════════════

const createMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_movimiento,
      empleado_responsable_nuevo_id,
      ubicacion_nueva_id,
      observaciones,
    } = req.body;

    if (!tipo_movimiento) {
      return res.status(400).json({ error: 'tipo_movimiento es obligatorio.' });
    }

    // Los triggers de BD validan el resto (ALTA requiere resp o ubic, BAJA requiere activo activo, etc.)
    const result = await pool.query(
      `INSERT INTO public.activos_fisicos_movimientos
         (activo_fisico_id, tipo_movimiento, usuario_id,
          empleado_responsable_nuevo_id, ubicacion_nueva_id, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        tipo_movimiento,
        req.siraUser?.id ?? null,
        empleado_responsable_nuevo_id || null,
        ubicacion_nueva_id || null,
        observaciones || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createMovimiento:', err);
    // Devolver el mensaje del trigger de BD directamente (son mensajes informativos)
    res.status(400).json({ error: err.message || 'Error al registrar movimiento.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOVIMIENTOS — TODOS (tab Movimientos)
// ═══════════════════════════════════════════════════════════════════════════════

const listMovimientos = async (req, res) => {
  try {
    const { search, tipo_movimiento, desde, hasta } = req.query;
    const params = [];
    const conditions = ['1=1'];

    if (search) {
      params.push(`%${search}%`);
      const ph = `$${params.length}`;
      conditions.push(`(a.sku ILIKE ${ph} OR a.nombre ILIKE ${ph})`);
    }
    if (tipo_movimiento) { params.push(tipo_movimiento); conditions.push(`m.tipo_movimiento = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`m.fecha_movimiento >= $${params.length}`); }
    if (hasta) { params.push(hasta); conditions.push(`m.fecha_movimiento <= $${params.length}::date + interval '1 day'`); }

    const result = await pool.query(
      `SELECT
         m.id, m.consecutivo, m.tipo_movimiento, m.fecha_movimiento,
         m.observaciones, m.estado,
         a.sku AS activo_sku, a.id AS activo_id, a.nombre AS activo_nombre,
         COALESCE(era.nombre_completo, TRIM(era.nombre||' '||era.apellido_paterno)) AS responsable_anterior,
         COALESCE(ern.nombre_completo, TRIM(ern.nombre||' '||ern.apellido_paterno)) AS responsable_nuevo,
         ua.nombre AS ubicacion_anterior,
         un.nombre AS ubicacion_nueva
       FROM public.activos_fisicos_movimientos m
       JOIN  public.activos_fisicos                        a   ON a.id  = m.activo_fisico_id
       LEFT JOIN public.empleados                          era ON era.id = m.empleado_responsable_anterior_id
       LEFT JOIN public.empleados                          ern ON ern.id = m.empleado_responsable_nuevo_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones ua  ON ua.id  = m.ubicacion_anterior_id
       LEFT JOIN public.catalogo_activo_fisico_ubicaciones un  ON un.id  = m.ubicacion_nueva_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.fecha_movimiento DESC
       LIMIT 500`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listMovimientos:', err);
    res.status(500).json({ error: 'Error al listar movimientos.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CARGA MASIVA
// ═══════════════════════════════════════════════════════════════════════════════

const bulkCreateActivos = async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de items.' });
  }

  const client = await pool.connect();
  const creados = [];
  const errores = [];

  try {
    await client.query('BEGIN');

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNum = i + 1;

      // Resolver categoria_id
      const catRes = await client.query(
        'SELECT id FROM public.catalogo_activo_fisico_categorias WHERE UPPER(clave) = UPPER($1)',
        [String(row.categoria_clave ?? '').trim()]
      );
      if (!catRes.rows.length) {
        errores.push(`Fila ${rowNum}: categoria_clave '${row.categoria_clave}' no encontrada.`);
        continue;
      }
      const categoria_id = catRes.rows[0].id;

      // Resolver tipo_id (debe pertenecer a la categoría)
      const tipRes = await client.query(
        `SELECT id FROM public.catalogo_activo_fisico_tipos
         WHERE UPPER(clave) = UPPER($1) AND categoria_id = $2`,
        [String(row.tipo_clave ?? '').trim(), categoria_id]
      );
      if (!tipRes.rows.length) {
        errores.push(`Fila ${rowNum}: tipo_clave '${row.tipo_clave}' no encontrado para la categoría dada.`);
        continue;
      }
      const tipo_id = tipRes.rows[0].id;

      if (!String(row.nombre ?? '').trim()) {
        errores.push(`Fila ${rowNum}: 'nombre' es obligatorio.`);
        continue;
      }

      try {
        const ins = await client.query(
          `INSERT INTO public.activos_fisicos
             (categoria_id, tipo_id, nombre, marca, modelo, numero_serie, codigo,
              fecha_compra, costo_compra, moneda, detalle_tecnico)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING sku, nombre`,
          [
            categoria_id, tipo_id,
            String(row.nombre).trim(),
            row.marca        || null,
            row.modelo       || null,
            row.numero_serie || null,
            row.codigo       || null,
            row.fecha_compra || null,
            row.costo_compra != null && row.costo_compra !== '' ? Number(row.costo_compra) : null,
            row.moneda       || null,
            row.detalle_tecnico || null,
          ]
        );
        creados.push(ins.rows[0]);
      } catch (rowErr) {
        if (rowErr.code === '23505') {
          errores.push(`Fila ${rowNum}: número de serie '${row.numero_serie}' duplicado.`);
        } else {
          errores.push(`Fila ${rowNum}: ${rowErr.message}`);
        }
      }
    }

    if (errores.length > 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Importación fallida. Corrige los errores e intenta de nuevo.', errores });
    }

    await client.query('COMMIT');
    res.status(201).json({ creados: creados.length, items: creados });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bulkCreateActivos:', err);
    res.status(500).json({ error: 'Error interno en la carga masiva.' });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Categorías
  listCategorias, createCategoria, updateCategoria,
  // Tipos
  listTipos, createTipo, updateTipo,
  // Ubicaciones
  listUbicaciones, createUbicacion, updateUbicacion,
  // Activos
  listActivos, createActivo, updateActivo, getPendientesCount, listPendientes,
  // Movimientos
  listMovimientosActivo, createMovimiento, listMovimientos,
  // Bulk
  bulkCreateActivos,
};
