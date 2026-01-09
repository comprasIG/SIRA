// backend/controllers/inventario.controller.js
/**
 * INVENTARIO CONTROLLER (SIRA)
 * =========================================================================================
 * Endpoints (deberían estar en rutas):
 * - GET  /api/inventario/datos-iniciales
 * - GET  /api/inventario
 * - GET  /api/inventario/catalogo-resumen
 * - GET  /api/inventario/material/:materialId/asignaciones
 * - GET  /api/inventario/kardex
 * - POST /api/inventario/ajustes
 * - POST /api/inventario/apartar
 * - POST /api/inventario/mover-asignacion
 * - POST /api/inventario/movimientos/:id/reversar
 *
 * Notas:
 * - Kardex auditable en movimientos_inventario.
 * - Ajustes/Reversas: solo superusuario.
 * - Apartado NO es salida real: registra tipo_movimiento = 'APARTADO'.
 * - Reversa:
 *   - Solo mismo día (fecha local MX) y sin negativos.
 *   - Marca el movimiento original como ANULADO y crea un movimiento de auditoría ligado.
 */

const pool = require("../db/pool");

/** =========================================================================================
 * Helpers (utilidades internas)
 * ======================================================================================= */

/**
 * Convierte números con coma a punto y maneja null/undefined.
 */
const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const s = value.toString().trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toTrimmedString = (value) => (value ?? "").toString().trim();

const respond500 = (res, label, error, msg = "Internal Server Error.") => {
  console.error(label, error);
  return res.status(500).json({ error: msg });
};

const isSuperuser = (usuarioSira) => {
  // En tu proyecto ya usas req.usuarioSira.es_superusuario
  return !!usuarioSira?.es_superusuario;
};

/**
 * Obtiene un parámetro del sistema (tabla public.parametros_sistema).
 * Ej: clave = 'id_sitio_almacen_central' => "21"
 */
const getParametroSistema = async (client, clave) => {
  const { rows } = await client.query(
    `SELECT valor FROM public.parametros_sistema WHERE clave = $1 LIMIT 1`,
    [clave]
  );
  return rows[0]?.valor ?? null;
};

/**
 * Selecciona (y bloquea) el registro inventario_actual por (material_id, ubicacion_id).
 * IMPORTANTE:
 * - Para consistencia de inventario, siempre usamos FOR UPDATE en transacciones.
 */
const getInventarioActualForUpdate = async (client, materialId, ubicacionId) => {
  const invRes = await client.query(
    `
    SELECT id, material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda
    FROM public.inventario_actual
    WHERE material_id = $1 AND ubicacion_id = $2
    FOR UPDATE
    `,
    [materialId, ubicacionId]
  );
  return invRes.rowCount ? invRes.rows[0] : null;
};

/**
 * Si no existe inventario_actual, lo crea en ceros (para permitir ajustes positivos / alta inicial).
 */
const ensureInventarioActualExists = async (client, materialId, ubicacionId) => {
  let inv = await getInventarioActualForUpdate(client, materialId, ubicacionId);
  if (inv) return inv;

  await client.query(
    `
    INSERT INTO public.inventario_actual
      (material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda)
    VALUES
      ($1, $2, 0, 0, 0, NULL)
    `,
    [materialId, ubicacionId]
  );

  inv = await getInventarioActualForUpdate(client, materialId, ubicacionId);
  if (!inv) {
    throw new Error("No se pudo crear inventario_actual para material/ubicación.");
  }
  return inv;
};

/**
 * Decrementa cantidad de inventario_asignado distribuyendo sobre filas existentes.
 * Criterio:
 * - inventario_id exacto
 * - proyecto_id exacto
 * - sitio_id opcional (si se pasa)
 * - requisicion_id IS NOT DISTINCT FROM (soporta NULL)
 *
 * Si no hay suficiente, lanza error (evita negativos).
 */
const decrementInventarioAsignado = async ({
  client,
  inventarioId,
  proyectoId,
  sitioId = null,
  requisicionId = null,
  cantidad,
}) => {
  let restante = toNumber(cantidad, 0);
  if (restante <= 0) return;

  const where = [];
  const params = [];
  let i = 1;

  where.push(`inventario_id = $${i++}`);
  params.push(inventarioId);

  where.push(`proyecto_id = $${i++}`);
  params.push(proyectoId);

  if (sitioId !== null && sitioId !== undefined) {
    where.push(`sitio_id = $${i++}`);
    params.push(sitioId);
  }

  // soporta NULL
  where.push(`requisicion_id IS NOT DISTINCT FROM $${i++}`);
  params.push(requisicionId);

  const rowsRes = await client.query(
    `
    SELECT id, cantidad
    FROM public.inventario_asignado
    WHERE ${where.join(" AND ")}
      AND cantidad > 0
    ORDER BY cantidad DESC, id ASC
    FOR UPDATE
    `,
    params
  );

  const total = (rowsRes.rows || []).reduce((acc, r) => acc + toNumber(r.cantidad, 0), 0);
  if (total < restante) {
    throw new Error(
      `No hay suficiente inventario_asignado para reversa. Requerido=${restante}, Disponible=${total}`
    );
  }

  for (const r of rowsRes.rows) {
    if (restante <= 0) break;
    const disponible = toNumber(r.cantidad, 0);
    const tomar = Math.min(restante, disponible);
    const nuevo = disponible - tomar;

    await client.query(
      `UPDATE public.inventario_asignado SET cantidad = $1 WHERE id = $2`,
      [nuevo, r.id]
    );

    restante -= tomar;
  }
};

/**
 * Incrementa inventario_asignado:
 * - si existe fila matching (inventario_id, proyecto_id, sitio_id, requisicion_id) la incrementa
 * - si no existe, inserta una nueva
 */
const upsertInventarioAsignado = async ({
  client,
  inventarioId,
  proyectoId,
  sitioId,
  requisicionId = null,
  cantidad,
  valorUnitario,
  moneda,
}) => {
  const qty = toNumber(cantidad, 0);
  if (qty <= 0) return;

  // Lock fila existente si existe
  const sel = await client.query(
    `
    SELECT id
    FROM public.inventario_asignado
    WHERE inventario_id = $1
      AND proyecto_id = $2
      AND sitio_id = $3
      AND requisicion_id IS NOT DISTINCT FROM $4
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
    `,
    [inventarioId, proyectoId, sitioId, requisicionId]
  );

  if (sel.rowCount > 0) {
    await client.query(
      `
      UPDATE public.inventario_asignado
         SET cantidad = cantidad + $1,
             valor_unitario = $2,
             moneda = $3,
             asignado_en = NOW()
       WHERE id = $4
      `,
      [qty, toNumber(valorUnitario, 0), moneda ?? null, sel.rows[0].id]
    );
  } else {
    await client.query(
      `
      INSERT INTO public.inventario_asignado
        (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      [
        inventarioId,
        requisicionId,
        proyectoId,
        sitioId,
        qty,
        toNumber(valorUnitario, 0),
        moneda ?? null,
      ]
    );
  }
};

/**
 * Verifica si el movimiento es del mismo día (fecha local CDMX).
 * Regla acordada: solo reversa mismo día.
 */
const isSameLocalDayMexicoCity = async (client, movimientoId) => {
  // CDMX: America/Mexico_City
  const { rows } = await client.query(
    `
    SELECT
      (mi.fecha AT TIME ZONE 'America/Mexico_City')::date AS fecha_mov_local,
      (NOW()    AT TIME ZONE 'America/Mexico_City')::date AS hoy_local
    FROM public.movimientos_inventario mi
    WHERE mi.id = $1
    `,
    [movimientoId]
  );

  if (!rows[0]) return false;
  return rows[0].fecha_mov_local?.toString() === rows[0].hoy_local?.toString();
};

/** =========================================================================================
 * GET /api/inventario/datos-iniciales
 * - KPIs (por moneda)
 * - Opciones de filtros
 * - ubicaciones_almacen
 * ======================================================================================= */
const getDatosIniciales = async (req, res) => {
  try {
    const kpiSkuQuery = `
      SELECT COUNT(DISTINCT material_id)::int AS kpi_skus
      FROM public.inventario_actual
      WHERE (COALESCE(stock_actual,0) + COALESCE(asignado,0)) > 0;
    `;

    const valorDisponibleQuery = `
      SELECT
        moneda,
        COALESCE(SUM(COALESCE(stock_actual,0) * COALESCE(ultimo_precio_entrada,0)), 0) AS valor_total
      FROM public.inventario_actual
      WHERE COALESCE(stock_actual,0) > 0
        AND COALESCE(ultimo_precio_entrada,0) > 0
        AND moneda IS NOT NULL
      GROUP BY moneda;
    `;

    const valorApartadoQuery = `
      SELECT
        moneda,
        COALESCE(SUM(COALESCE(cantidad,0) * COALESCE(valor_unitario,0)), 0) AS valor_total
      FROM public.inventario_asignado
      WHERE COALESCE(cantidad,0) > 0
        AND COALESCE(valor_unitario,0) > 0
        AND moneda IS NOT NULL
      GROUP BY moneda;
    `;

    // Sitios/proyectos con apartados (para filtros "con datos")
    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre
      FROM public.sitios s
      JOIN public.inventario_asignado ias ON s.id = ias.sitio_id
      WHERE COALESCE(ias.cantidad,0) > 0
      ORDER BY s.nombre ASC;
    `;

    const proyectosQuery = `
      SELECT DISTINCT p.id, p.nombre, p.sitio_id
      FROM public.proyectos p
      JOIN public.inventario_asignado ias ON p.id = ias.proyecto_id
      WHERE COALESCE(ias.cantidad,0) > 0
      ORDER BY p.nombre ASC;
    `;

    const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM public.proyectos ORDER BY nombre ASC;`;
    const todosSitiosQuery = `SELECT id, nombre FROM public.sitios ORDER BY nombre ASC;`;

    const ubicacionesAlmacenQuery = `
      SELECT id, codigo, nombre
      FROM public.ubicaciones_almacen
      ORDER BY id ASC;
    `;

    const [
      kpiSkuRes,
      valorDisponibleRes,
      valorApartadoRes,
      sitiosRes,
      proyectosRes,
      todosProyectosRes,
      todosSitiosRes,
      ubicacionesAlmacenRes,
    ] = await Promise.all([
      pool.query(kpiSkuQuery),
      pool.query(valorDisponibleQuery),
      pool.query(valorApartadoQuery),
      pool.query(sitiosQuery),
      pool.query(proyectosQuery),
      pool.query(todosProyectosQuery),
      pool.query(todosSitiosQuery),
      pool.query(ubicacionesAlmacenQuery),
    ]);

    return res.json({
      kpis: {
        kpi_skus: kpiSkuRes.rows[0]?.kpi_skus ?? 0,
        valores_disponibles: (valorDisponibleRes.rows || []).map((r) => ({
          moneda: r.moneda,
          valor_total: Number(r.valor_total || 0).toFixed(2),
        })),
        valores_apartados: (valorApartadoRes.rows || []).map((r) => ({
          moneda: r.moneda,
          valor_total: Number(r.valor_total || 0).toFixed(2),
        })),
      },
      filterOptions: {
        sitios: sitiosRes.rows || [],
        proyectos: proyectosRes.rows || [],
        todosSitios: todosSitiosRes.rows || [],
        todosProyectos: todosProyectosRes.rows || [],
        ubicacionesAlmacen: ubicacionesAlmacenRes.rows || [],
      },
    });
  } catch (error) {
    return respond500(res, "Error fetching initial data for /INV:", error);
  }
};

/** =========================================================================================
 * GET /api/inventario
 * Lista principal (solo "existentes"), 1 fila por material (agregado).
 * Query:
 * - estado: TODOS | DISPONIBLE | APARTADO
 * - sitioId / proyectoId: filtra por apartados (inventario_asignado)
 * - search: palabras por nombre
 * ======================================================================================= */
const getInventarioActual = async (req, res) => {
  const { estado = "TODOS", sitioId, proyectoId, search } = req.query;

  const params = [];
  let i = 1;

  let sql = `
    SELECT
      ia.material_id,
      cm.sku,
      cm.nombre AS material_nombre,
      cu.simbolo AS unidad_simbolo,

      COALESCE(SUM(ia.stock_actual), 0) AS total_stock,
      COALESCE(SUM(ia.asignado), 0) AS total_asignado,
      (COALESCE(SUM(ia.stock_actual), 0) + COALESCE(SUM(ia.asignado), 0)) AS total_existencia

    FROM public.inventario_actual ia
    JOIN public.catalogo_materiales cm ON cm.id = ia.material_id
    JOIN public.catalogo_unidades cu ON cu.id = cm.unidad_de_compra
  `;

  const where = [];
  const having = [];

  // Búsqueda por palabras en nombre
  if (search) {
    const words = search
      .split(" ")
      .map((w) => w.trim())
      .filter(Boolean);
    for (const w of words) {
      where.push(`unaccent(cm.nombre) ILIKE unaccent($${i++})`);
      params.push(`%${w}%`);
    }
  }

  // Filtrar por apartados (sitio/proyecto)
  if ((estado === "TODOS" || estado === "APARTADO") && (sitioId || proyectoId)) {
    let sub = `
      ia.material_id IN (
        SELECT DISTINCT ia2.material_id
        FROM public.inventario_asignado ias
        JOIN public.inventario_actual ia2 ON ia2.id = ias.inventario_id
        WHERE COALESCE(ias.cantidad,0) > 0
    `;

    if (sitioId) {
      sub += ` AND ias.sitio_id = $${i++}`;
      params.push(sitioId);
    }
    if (proyectoId) {
      sub += ` AND ias.proyecto_id = $${i++}`;
      params.push(proyectoId);
    }

    sub += `)`;
    where.push(sub);
  }

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` GROUP BY ia.material_id, cm.sku, cm.nombre, cu.simbolo`;

  if (estado === "DISPONIBLE") having.push(`COALESCE(SUM(ia.stock_actual),0) > 0`);
  if (estado === "APARTADO") having.push(`COALESCE(SUM(ia.asignado),0) > 0`);
  if (having.length) sql += ` HAVING ${having.join(" AND ")}`;

  sql += ` ORDER BY cm.nombre ASC`;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    return respond500(res, "Error fetching inventory list:", error);
  }
};

/** =========================================================================================
 * GET /api/inventario/catalogo-resumen
 * Devuelve TODO el catálogo de materiales ACTIVOS, aunque no exista en inventario_actual.
 * Ideal para ajustes (alta inicial / stock en ceros).
 * ======================================================================================= */
const getCatalogoResumen = async (req, res) => {
  const { estado = "TODOS", sitioId, proyectoId, search } = req.query;

  const params = [];
  let i = 1;

  let sql = `
    SELECT
      cm.id AS material_id,
      cm.sku,
      cm.nombre AS material_nombre,
      cu.simbolo AS unidad_simbolo,

      COALESCE(SUM(ia.stock_actual), 0) AS total_stock,
      COALESCE(SUM(ia.asignado), 0) AS total_asignado,
      (COALESCE(SUM(ia.stock_actual), 0) + COALESCE(SUM(ia.asignado), 0)) AS total_existencia

    FROM public.catalogo_materiales cm
    JOIN public.catalogo_unidades cu ON cu.id = cm.unidad_de_compra
    LEFT JOIN public.inventario_actual ia ON ia.material_id = cm.id
  `;

  const where = [`cm.activo IS TRUE`];
  const having = [];

  if (search) {
    const words = search
      .split(" ")
      .map((w) => w.trim())
      .filter(Boolean);
    for (const w of words) {
      where.push(`unaccent(cm.nombre) ILIKE unaccent($${i++})`);
      params.push(`%${w}%`);
    }
  }

  if ((estado === "TODOS" || estado === "APARTADO") && (sitioId || proyectoId)) {
    let sub = `
      cm.id IN (
        SELECT DISTINCT ia2.material_id
        FROM public.inventario_asignado ias
        JOIN public.inventario_actual ia2 ON ia2.id = ias.inventario_id
        WHERE COALESCE(ias.cantidad,0) > 0
    `;

    if (sitioId) {
      sub += ` AND ias.sitio_id = $${i++}`;
      params.push(sitioId);
    }
    if (proyectoId) {
      sub += ` AND ias.proyecto_id = $${i++}`;
      params.push(proyectoId);
    }

    sub += `)`;
    where.push(sub);
  }

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` GROUP BY cm.id, cm.sku, cm.nombre, cu.simbolo`;

  if (estado === "DISPONIBLE") having.push(`COALESCE(SUM(ia.stock_actual),0) > 0`);
  if (estado === "APARTADO") having.push(`COALESCE(SUM(ia.asignado),0) > 0`);
  if (having.length) sql += ` HAVING ${having.join(" AND ")}`;

  sql += ` ORDER BY cm.nombre ASC`;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    return respond500(res, "Error fetching catalogo-resumen:", error, "Error al cargar el catálogo resumen.");
  }
};

/** =========================================================================================
 * GET /api/inventario/material/:materialId/asignaciones
 * Devuelve filas de inventario_asignado > 0 para ese material.
 * ======================================================================================= */
const getDetalleAsignacionesMaterial = async (req, res) => {
  const { materialId } = req.params;

  try {
    const sql = `
      SELECT
        ias.id AS asignacion_id,
        ia.material_id,
        ias.inventario_id,
        ias.requisicion_id,
        ias.proyecto_id,
        p.nombre AS proyecto_nombre,
        ias.sitio_id,
        s.nombre AS sitio_nombre,
        ias.cantidad,
        ias.valor_unitario,
        ias.moneda,
        ias.asignado_en
      FROM public.inventario_asignado ias
      JOIN public.inventario_actual ia ON ia.id = ias.inventario_id
      JOIN public.proyectos p ON p.id = ias.proyecto_id
      JOIN public.sitios s ON s.id = ias.sitio_id
      WHERE ia.material_id = $1
        AND COALESCE(ias.cantidad,0) > 0
      ORDER BY p.nombre ASC, s.nombre ASC, ias.id ASC;
    `;

    const { rows } = await pool.query(sql, [materialId]);
    return res.json(rows || []);
  } catch (error) {
    return respond500(res, `Error fetching assignments for material ${materialId}:`, error);
  }
};

/** =========================================================================================
 * GET /api/inventario/kardex
 * Filtros:
 * - materialId, proyectoId, ubicacionId, tipoMovimiento, ordenCompraId, requisicionId, usuarioId
 * - fechaInicio, fechaFin (YYYY-MM-DD)
 * - includeAnulados (true/false)
 * - q (texto en observaciones)
 * - limit, offset
 * ======================================================================================= */
const getKardex = async (req, res) => {
  try {
    const {
      materialId,
      proyectoId,
      ubicacionId,
      tipoMovimiento,
      ordenCompraId,
      requisicionId,
      usuarioId,
      fechaInicio,
      fechaFin,
      includeAnulados = "false",
      limit = "100",
      offset = "0",
      q,
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    const where = [];
    const values = [];
    let i = 1;

    if (includeAnulados !== "true") where.push(`mi.estado = 'ACTIVO'`);

    if (materialId) {
      where.push(`mi.material_id = $${i++}`);
      values.push(materialId);
    }

    if (proyectoId) {
      // Para TRASPASO, el proyecto puede estar como origen o destino
      where.push(`(mi.proyecto_origen_id = $${i} OR mi.proyecto_destino_id = $${i})`);
      values.push(proyectoId);
      i++;
    }

    if (ubicacionId) {
      where.push(`mi.ubicacion_id = $${i++}`);
      values.push(ubicacionId);
    }

    if (tipoMovimiento) {
      where.push(`mi.tipo_movimiento = $${i++}`);
      values.push(tipoMovimiento);
    }

    if (ordenCompraId) {
      where.push(`mi.orden_compra_id = $${i++}`);
      values.push(ordenCompraId);
    }

    if (requisicionId) {
      where.push(`mi.requisicion_id = $${i++}`);
      values.push(requisicionId);
    }

    if (usuarioId) {
      where.push(`mi.usuario_id = $${i++}`);
      values.push(usuarioId);
    }

    if (fechaInicio) {
      where.push(`mi.fecha >= $${i++}::timestamptz`);
      values.push(`${fechaInicio} 00:00:00`);
    }

    if (fechaFin) {
      where.push(`mi.fecha <= $${i++}::timestamptz`);
      values.push(`${fechaFin} 23:59:59`);
    }

    if (q) {
      where.push(`COALESCE(mi.observaciones, '') ILIKE $${i++}`);
      values.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        mi.id,
        mi.fecha,
        mi.tipo_movimiento,
        mi.material_id,
        cm.nombre AS material_descripcion,
        mi.cantidad,
        mi.valor_unitario,
        mi.valor_total,
        mi.moneda,
        mi.ubicacion_id,
        ua.nombre AS ubicacion_nombre,
        mi.proyecto_origen_id,
        po.nombre AS proyecto_origen_nombre,
        mi.proyecto_destino_id,
        pd.nombre AS proyecto_destino_nombre,
        mi.orden_compra_id,
        mi.requisicion_id,
        mi.usuario_id,
        u.nombre AS usuario_nombre,
        mi.observaciones,
        mi.estado,
        mi.anulado_en,
        mi.anulado_por,
        u2.nombre AS anulado_por_nombre,
        mi.motivo_anulacion,
        mi.reversa_de_movimiento_id
      FROM public.movimientos_inventario mi
      LEFT JOIN public.catalogo_materiales cm ON cm.id = mi.material_id
      LEFT JOIN public.ubicaciones_almacen ua ON ua.id = mi.ubicacion_id
      LEFT JOIN public.proyectos po ON po.id = mi.proyecto_origen_id
      LEFT JOIN public.proyectos pd ON pd.id = mi.proyecto_destino_id
      LEFT JOIN public.usuarios u ON u.id = mi.usuario_id
      LEFT JOIN public.usuarios u2 ON u2.id = mi.anulado_por
      ${whereSql}
      ORDER BY mi.fecha DESC, mi.id DESC
      LIMIT $${i++} OFFSET $${i++};
    `;

    values.push(lim, off);

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.movimientos_inventario mi
      ${whereSql};
    `;
    const countValues = values.slice(0, values.length - 2);

    const [rowsResult, countResult] = await Promise.all([
      pool.query(sql, values),
      pool.query(countSql, countValues),
    ]);

    return res.status(200).json({
      total: countResult.rows[0]?.total ?? 0,
      limit: lim,
      offset: off,
      rows: rowsResult.rows || [],
    });
  } catch (error) {
    return respond500(res, "Error en getKardex:", error, "Error al consultar el kardex.");
  }
};

/** =========================================================================================
 * POST /api/inventario/ajustes
 * - Solo superusuario
 * - Permite crear inventario_actual si no existe (alta inicial)
 * - Precio/moneda solo si (stock + asignado) == 0 y delta > 0
 * ======================================================================================= */
const ajustarInventario = async (req, res) => {
  const { id: usuarioId, es_superusuario } = req.usuarioSira;

  if (!es_superusuario) {
    return res.status(403).json({ error: "No autorizado. Solo superusuario puede realizar ajustes." });
  }

  const payload = req.body?.ajustes ? req.body.ajustes : req.body;
  const ajustes = Array.isArray(payload) ? payload : [payload];

  if (!Array.isArray(ajustes) || ajustes.length === 0) {
    return res.status(400).json({ error: "Debes enviar al menos un ajuste." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resultados = [];

    for (const a of ajustes) {
      const material_id = a?.material_id;
      const deltaNum = toNumber(a?.delta, NaN);
      let ubicacion_id = a?.ubicacion_id ?? null;

      const observaciones = toTrimmedString(a?.observaciones);
      const precioInput = a?.ultimo_precio_entrada;
      const monedaInput = a?.moneda;

      if (!material_id) throw new Error("material_id es requerido.");
      if (!Number.isFinite(deltaNum) || deltaNum === 0) throw new Error("delta debe ser un número distinto de 0.");
      if (!observaciones) throw new Error("observaciones es requerido (texto).");

      // Validar / resolver ubicacion_id (si no viene, usar primera ubicación)
      if (!ubicacion_id) {
        const def = await client.query(`SELECT id FROM public.ubicaciones_almacen ORDER BY id ASC LIMIT 1`);
        if (def.rowCount === 0) {
          throw new Error(
            "No existe ninguna ubicación en ubicaciones_almacen. Debes crear una o enviar ubicacion_id."
          );
        }
        ubicacion_id = def.rows[0].id;
      } else {
        const exists = await client.query(`SELECT 1 FROM public.ubicaciones_almacen WHERE id = $1`, [ubicacion_id]);
        if (exists.rowCount === 0) {
          throw new Error("ubicacion_id inválida: debe existir en ubicaciones_almacen.");
        }
      }

      // Lock / ensure inventario_actual
      const inv = await ensureInventarioActualExists(client, material_id, ubicacion_id);

      const stockActual = toNumber(inv.stock_actual, 0);
      const asignado = toNumber(inv.asignado, 0);
      const totalAntes = stockActual + asignado;

      // No permitir stock disponible negativo
      const stockNuevo = stockActual + deltaNum;
      if (stockNuevo < 0) {
        throw new Error(`Stock insuficiente para ajuste negativo. Disponible: ${stockActual}, delta: ${deltaNum}`);
      }

      // Precio/moneda solo cuando totalAntes == 0 y delta > 0
      const puedeEditarPrecio = totalAntes === 0 && deltaNum > 0;

      const traePrecio = precioInput !== undefined && precioInput !== null && `${precioInput}` !== "";
      const traeMoneda = monedaInput !== undefined && monedaInput !== null && `${monedaInput}` !== "";

      if ((traePrecio || traeMoneda) && !puedeEditarPrecio) {
        throw new Error(
          "Solo se permite modificar precio/moneda cuando (disponible + asignado) = 0 y el ajuste es positivo."
        );
      }

      let precioFinal = toNumber(inv.ultimo_precio_entrada, 0);
      let monedaFinal = inv.moneda || null;

      if (puedeEditarPrecio && traePrecio) {
        const precioNum = toNumber(precioInput, NaN);
        if (!Number.isFinite(precioNum) || precioNum <= 0) {
          throw new Error("ultimo_precio_entrada debe ser un número > 0 cuando se envía.");
        }
        if (!traeMoneda) {
          throw new Error("moneda es obligatoria cuando se envía ultimo_precio_entrada.");
        }
        const monedaStr = toTrimmedString(monedaInput).toUpperCase();
        if (monedaStr.length !== 3) {
          throw new Error("moneda debe ser un código de 3 letras (ej. MXN, USD).");
        }

        precioFinal = precioNum;
        monedaFinal = monedaStr;

        await client.query(
          `
          UPDATE public.inventario_actual
             SET stock_actual = stock_actual + $1,
                 ultimo_precio_entrada = $2,
                 moneda = $3,
                 actualizado_en = NOW()
           WHERE id = $4
          `,
          [deltaNum, precioFinal, monedaFinal, inv.id]
        );
      } else {
        await client.query(
          `
          UPDATE public.inventario_actual
             SET stock_actual = stock_actual + $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [deltaNum, inv.id]
        );
      }

      // Kardex
      const tipo_movimiento = deltaNum > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";
      const cantidadMovimiento = Math.abs(deltaNum);

      const movRes = await client.query(
        `
        INSERT INTO public.movimientos_inventario
          (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, valor_unitario, moneda, observaciones)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, fecha
        `,
        [material_id, tipo_movimiento, cantidadMovimiento, usuarioId, ubicacion_id, precioFinal, monedaFinal, observaciones]
      );

      const invFinalRes = await client.query(
        `
        SELECT material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda
        FROM public.inventario_actual
        WHERE material_id = $1 AND ubicacion_id = $2
        `,
        [material_id, ubicacion_id]
      );

      resultados.push({
        material_id,
        ubicacion_id,
        delta: deltaNum,
        movimiento: movRes.rows[0],
        inventario: invFinalRes.rows[0],
      });
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, resultados });
  } catch (error) {
    await client.query("ROLLBACK");
    const msg = error.message || "Error interno al ajustar inventario.";
    console.error("Error en ajustarInventario:", error);

    const isValidation =
      msg.includes("requerido") ||
      msg.includes("delta") ||
      msg.includes("Stock insuficiente") ||
      msg.includes("ubicacion_id inválida") ||
      msg.includes("Solo se permite modificar precio");

    return res.status(isValidation ? 400 : 500).json({ error: msg });
  } finally {
    client.release();
  }
};

/** =========================================================================================
 * POST /api/inventario/apartar
 * - Multi-ubicación (mayor stock a menor)
 * - Mueve stock_actual -> asignado
 * - Upsert inventario_asignado
 * - Kardex tipo_movimiento = 'APARTADO'
 *
 * Body:
 * - material_id (req)
 * - cantidad (req)
 * - sitio_id (req)
 * - proyecto_id (req)
 * - requisicion_id (opcional)
 * ======================================================================================= */
const apartarStock = async (req, res) => {
  const { material_id, cantidad, sitio_id, proyecto_id, requisicion_id } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  const cantidadNum = toNumber(cantidad, 0);
  const requisicionId = toInt(requisicion_id, null);

  if (!material_id || cantidadNum <= 0 || !sitio_id || !proyecto_id) {
    return res.status(400).json({ error: "Faltan datos para apartar el material." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Traer ubicaciones con stock disponible (lock)
    const ubicacionesStock = await client.query(
      `
      SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
      FROM public.inventario_actual
      WHERE material_id = $1 AND COALESCE(stock_actual,0) > 0
      ORDER BY stock_actual DESC, id ASC
      FOR UPDATE
      `,
      [material_id]
    );

    const totalDisponible = (ubicacionesStock.rows || []).reduce(
      (sum, u) => sum + toNumber(u.stock_actual, 0),
      0
    );

    if (ubicacionesStock.rowCount === 0 || totalDisponible < cantidadNum) {
      throw new Error(
        `Stock insuficiente. Solicitado: ${cantidadNum}, Disponible: ${totalDisponible}`
      );
    }

    let restante = cantidadNum;
    const detalles = [];

    for (const ubi of ubicacionesStock.rows) {
      if (restante <= 0) break;

      const stockEnUbicacion = toNumber(ubi.stock_actual, 0);
      if (stockEnUbicacion <= 0) continue;

      const tomar = Math.min(restante, stockEnUbicacion);

      const valorUnitario = toNumber(ubi.ultimo_precio_entrada, 0);
      const moneda = ubi.moneda || null;

      // 1) inventario_actual: DISPONIBLE -> ASIGNADO
      await client.query(
        `
        UPDATE public.inventario_actual
           SET stock_actual = stock_actual - $1,
               asignado     = asignado + $1,
               actualizado_en = NOW()
         WHERE id = $2
        `,
        [tomar, ubi.id]
      );

      // 2) inventario_asignado: upsert
      await upsertInventarioAsignado({
        client,
        inventarioId: ubi.id,
        proyectoId: proyecto_id,
        sitioId: sitio_id,
        requisicionId,
        cantidad: tomar,
        valorUnitario,
        moneda,
      });

      // 3) Kardex: APARTADO (incluye sitio en observaciones para auditoría)
      await client.query(
        `
        INSERT INTO public.movimientos_inventario
          (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
           proyecto_destino_id, requisicion_id, valor_unitario, moneda, observaciones)
        VALUES
          ($1, 'APARTADO', $2, $3, $4,
           $5, $6, $7, $8, $9)
        `,
        [
          material_id,
          tomar,
          usuarioId,
          ubi.ubicacion_id,
          proyecto_id,
          requisicionId,
          valorUnitario,
          moneda,
          `APARTADO a proyecto=${proyecto_id} sitio=${sitio_id}${requisicionId ? ` req=${requisicionId}` : ""}`,
        ]
      );

      detalles.push({ ubicacion_id: ubi.ubicacion_id, cantidad: tomar });
      restante -= tomar;
    }

    await client.query("COMMIT");
    return res.status(200).json({ mensaje: "Material apartado exitosamente.", detalles });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al apartar stock:", error);
    return res.status(500).json({ error: error.message || "Error interno al apartar stock." });
  } finally {
    client.release();
  }
};

/** =========================================================================================
 * POST /api/inventario/mover-asignacion
 * - Mueve una asignación existente entre proyectos/sitios
 * - Soporta mover TOTAL (default) o PARCIAL (si body.cantidad viene)
 * - Kardex: TRASPASO
 *
 * Body:
 * - asignacion_id (req)
 * - nuevo_sitio_id (req)
 * - nuevo_proyecto_id (req)
 * - cantidad (opcional; si no viene => mover todo)
 * ======================================================================================= */
const moverAsignacion = async (req, res) => {
  const { asignacion_id, nuevo_sitio_id, nuevo_proyecto_id, cantidad } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!asignacion_id || !nuevo_sitio_id || !nuevo_proyecto_id) {
    return res.status(400).json({ error: "Faltan datos para mover la asignación." });
  }

  const moverQty = cantidad !== undefined && cantidad !== null && `${cantidad}` !== ""
    ? toNumber(cantidad, NaN)
    : null;

  if (moverQty !== null && (!Number.isFinite(moverQty) || moverQty <= 0)) {
    return res.status(400).json({ error: "cantidad debe ser un número > 0 (si se envía)." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquea asignación origen
    const asigRes = await client.query(
      `
      SELECT
        ias.id,
        ias.inventario_id,
        ias.requisicion_id,
        ias.proyecto_id,
        ias.sitio_id,
        ias.cantidad,
        ias.valor_unitario,
        ias.moneda,
        ia.material_id,
        ia.ubicacion_id
      FROM public.inventario_asignado ias
      JOIN public.inventario_actual ia ON ia.id = ias.inventario_id
      WHERE ias.id = $1
      FOR UPDATE
      `,
      [asignacion_id]
    );

    if (asigRes.rowCount === 0) {
      throw new Error(`Asignación con ID ${asignacion_id} no encontrada.`);
    }

    const asig = asigRes.rows[0];
    const origenProyecto = asig.proyecto_id;
    const origenSitio = asig.sitio_id;
    const destinoProyecto = nuevo_proyecto_id;
    const destinoSitio = nuevo_sitio_id;

    const qtyOrigen = toNumber(asig.cantidad, 0);
    const qtyMover = moverQty === null ? qtyOrigen : moverQty;

    if (qtyMover > qtyOrigen) {
      throw new Error(`No puedes mover más de lo asignado. Asignado=${qtyOrigen}, solicitado=${qtyMover}`);
    }

    // Si destino es igual al origen, no hacemos nada (idempotente)
    if (String(origenProyecto) === String(destinoProyecto) && String(origenSitio) === String(destinoSitio)) {
      await client.query("ROLLBACK");
      return res.status(200).json({ mensaje: "La asignación ya está en ese destino (sin cambios)." });
    }

    // Si mueve parcial: decrementa origen y upsert destino
    if (qtyMover < qtyOrigen) {
      await client.query(
        `UPDATE public.inventario_asignado SET cantidad = cantidad - $1 WHERE id = $2`,
        [qtyMover, asignacion_id]
      );
    } else {
      // mueve total: dejamos origen en 0 (o podrías borrar la fila; mantenemos historial)
      await client.query(
        `UPDATE public.inventario_asignado SET cantidad = 0 WHERE id = $1`,
        [asignacion_id]
      );
    }

    // Upsert destino manteniendo inventario_id (misma ubicación física)
    await upsertInventarioAsignado({
      client,
      inventarioId: asig.inventario_id,
      proyectoId: destinoProyecto,
      sitioId: destinoSitio,
      requisicionId: asig.requisicion_id ?? null,
      cantidad: qtyMover,
      valorUnitario: asig.valor_unitario,
      moneda: asig.moneda,
    });

    // Kardex TRASPASO
    await client.query(
      `
      INSERT INTO public.movimientos_inventario
        (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
         proyecto_origen_id, proyecto_destino_id, requisicion_id,
         valor_unitario, moneda, observaciones)
      VALUES
        ($1, 'TRASPASO', $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10)
      `,
      [
        asig.material_id,
        qtyMover,
        usuarioId,
        asig.ubicacion_id,
        origenProyecto,
        destinoProyecto,
        asig.requisicion_id ?? null,
        toNumber(asig.valor_unitario, 0),
        asig.moneda ?? null,
        `TRASPASO de asignación: origen(proy=${origenProyecto}, sitio=${origenSitio}) -> destino(proy=${destinoProyecto}, sitio=${destinoSitio})`,
      ]
    );

    await client.query("COMMIT");
    return res.status(200).json({ mensaje: "Asignación movida exitosamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al mover asignación:", error);
    return res.status(500).json({ error: error.message || "Error interno al mover asignación." });
  } finally {
    client.release();
  }
};

/** =========================================================================================
 * POST /api/inventario/movimientos/:id/reversar
 * Reglas:
 * - Solo superusuario
 * - Solo mismo día (CDMX)
 * - Bloquear si la reversa generaría negativos
 * - Marca movimiento original como ANULADO (estado/anulado_en/anulado_por/motivo)
 * - Inserta un movimiento de auditoría ligado con reversa_de_movimiento_id
 *
 * Body:
 * - motivo (req)
 * ======================================================================================= */
const reversarMovimiento = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!isSuperuser(req.usuarioSira)) {
    return res.status(403).json({ error: "Solo superusuario puede reversar movimientos." });
  }

  const motivoTxt = toTrimmedString(motivo);
  if (!motivoTxt || motivoTxt.length < 3) {
    return res.status(400).json({ error: "Motivo de anulación requerido." });
  }

  const movimientoId = toInt(id, null);
  if (!movimientoId) {
    return res.status(400).json({ error: "ID de movimiento inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock del movimiento original
    const movRes = await client.query(
      `
      SELECT *
      FROM public.movimientos_inventario
      WHERE id = $1
      FOR UPDATE
      `,
      [movimientoId]
    );

    if (movRes.rowCount === 0) {
      throw new Error("Movimiento no encontrado.");
    }

    const mov = movRes.rows[0];

    if (mov.estado !== "ACTIVO") {
      throw new Error("Este movimiento ya está anulado o no está activo.");
    }

    // Mismo día (CDMX)
    const sameDay = await isSameLocalDayMexicoCity(client, movimientoId);
    if (!sameDay) {
      throw new Error("Solo se permite reversar movimientos del mismo día (hora CDMX).");
    }

    const materialId = mov.material_id;
    const ubicacionId = mov.ubicacion_id;
    const cantidad = toNumber(mov.cantidad, 0);

    if (cantidad <= 0) {
      throw new Error("Cantidad inválida en el movimiento (debe ser > 0).");
    }

    // Asegura/lock inventario_actual (para la ubicación del movimiento)
    const inv = await ensureInventarioActualExists(client, materialId, ubicacionId);

    // Helper para crear movimiento auditoría de reversa (NO sustituye el original, lo complementa)
    const insertReversaAudit = async ({
      tipo_movimiento,
      proyecto_origen_id,
      proyecto_destino_id,
      observacionesExtra,
    }) => {
      await client.query(
        `
        INSERT INTO public.movimientos_inventario
          (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
           proyecto_origen_id, proyecto_destino_id, orden_compra_id, requisicion_id,
           valor_unitario, moneda, observaciones, reversa_de_movimiento_id)
        VALUES
          ($1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13)
        `,
        [
          materialId,
          tipo_movimiento,
          cantidad,
          usuarioId,
          ubicacionId,
          proyecto_origen_id ?? null,
          proyecto_destino_id ?? null,
          mov.orden_compra_id ?? null,
          mov.requisicion_id ?? null,
          toNumber(mov.valor_unitario, 0),
          mov.moneda ?? null,
          `REVERSA de movimiento #${movimientoId}. Motivo: ${motivoTxt}. ${observacionesExtra || ""}`.trim(),
          movimientoId,
        ]
      );
    };

    /**
     * Lógica de reversa por tipo:
     * - AJUSTE_POSITIVO: se sumó a stock -> revertir restando stock.
     * - AJUSTE_NEGATIVO: se restó stock -> revertir sumando stock.
     * - APARTADO: se movió stock -> asignado -> revertir asignado->stock y bajar inventario_asignado.
     * - TRASPASO: se movió entre proyectos (inventario_asignado) -> revertir swap.
     * - ENTRADA: depende si entró a stock o asignado (según OC.sitio y parámetro id_sitio_almacen_central)
     * - SALIDA: resta de asignado (típico) -> revertir sumando asignado y regresando a inventario_asignado
     */
    const tipo = mov.tipo_movimiento;

    // Tomamos valores actuales (lock ya está hecho)
    const stockActual = toNumber(inv.stock_actual, 0);
    const asignadoActual = toNumber(inv.asignado, 0);

    if (tipo === "AJUSTE_POSITIVO") {
      // Para anular un ajuste positivo, hay que retirar lo que se agregó al stock.
      if (stockActual < cantidad) {
        throw new Error(`Reversa inválida: dejaría stock negativo. Stock=${stockActual}, requerido=${cantidad}`);
      }

      await client.query(
        `
        UPDATE public.inventario_actual
           SET stock_actual = stock_actual - $1,
               actualizado_en = NOW()
         WHERE id = $2
        `,
        [cantidad, inv.id]
      );

      await insertReversaAudit({
        tipo_movimiento: "AJUSTE_NEGATIVO",
        proyecto_origen_id: null,
        proyecto_destino_id: mov.proyecto_destino_id ?? null,
        observacionesExtra: "Compensación por reversa de AJUSTE_POSITIVO.",
      });
    } else if (tipo === "AJUSTE_NEGATIVO") {
      // Para anular un ajuste negativo, regresamos stock.
      await client.query(
        `
        UPDATE public.inventario_actual
           SET stock_actual = stock_actual + $1,
               actualizado_en = NOW()
         WHERE id = $2
        `,
        [cantidad, inv.id]
      );

      await insertReversaAudit({
        tipo_movimiento: "AJUSTE_POSITIVO",
        proyecto_origen_id: null,
        proyecto_destino_id: mov.proyecto_destino_id ?? null,
        observacionesExtra: "Compensación por reversa de AJUSTE_NEGATIVO.",
      });
    } else if (tipo === "APARTADO") {
      // Apartado: stock -> asignado. Reversa: asignado -> stock + bajar inventario_asignado.
      if (asignadoActual < cantidad) {
        throw new Error(
          `Reversa inválida: no hay asignado suficiente. Asignado=${asignadoActual}, requerido=${cantidad}`
        );
      }

      // Debe existir asignación en inventario_asignado para ese proyecto (sitio puede variar);
      // aquí decrementamos sobre filas existentes con mismo inventario_id y proyecto_destino_id.
      const proyectoDestino = mov.proyecto_destino_id;
      if (!proyectoDestino) {
        throw new Error("Movimiento APARTADO sin proyecto_destino_id. No se puede reversar automáticamente.");
      }

      await decrementInventarioAsignado({
        client,
        inventarioId: inv.id,
        proyectoId: proyectoDestino,
        sitioId: null, // no viene en movimientos_inventario, decrementamos por proyecto
        requisicionId: mov.requisicion_id ?? null,
        cantidad,
      });

      await client.query(
        `
        UPDATE public.inventario_actual
           SET asignado     = asignado - $1,
               stock_actual = stock_actual + $1,
               actualizado_en = NOW()
         WHERE id = $2
        `,
        [cantidad, inv.id]
      );

      await insertReversaAudit({
        tipo_movimiento: "TRASPASO",
        proyecto_origen_id: proyectoDestino,
        proyecto_destino_id: null, // regreso a disponible
        observacionesExtra: "Reversa de APARTADO: regresa de asignado a disponible.",
      });
    } else if (tipo === "TRASPASO") {
      // TRASPASO: se movió inventario_asignado de proyecto_origen -> proyecto_destino.
      // Reversa: mover de proyecto_destino -> proyecto_origen.
      const po = mov.proyecto_origen_id;
      const pd = mov.proyecto_destino_id;

      if (!po || !pd) {
        throw new Error("TRASPASO sin proyecto_origen/destino. No se puede reversar automáticamente.");
      }

      // Decrementa destino y suma origen (conservando sitio por fila de destino cuando sea posible).
      // Como no tenemos sitio exacto en movimiento, hacemos:
      // - Tomar filas del destino (inventario_id + proyecto_destino + requisicion) y mover cantidades hacia origen
      let restante = cantidad;

      const destRows = await client.query(
        `
        SELECT id, sitio_id, requisicion_id, cantidad, valor_unitario, moneda
        FROM public.inventario_asignado
        WHERE inventario_id = $1
          AND proyecto_id = $2
          AND requisicion_id IS NOT DISTINCT FROM $3
          AND cantidad > 0
        ORDER BY cantidad DESC, id ASC
        FOR UPDATE
        `,
        [inv.id, pd, mov.requisicion_id ?? null]
      );

      const totalDest = (destRows.rows || []).reduce((acc, r) => acc + toNumber(r.cantidad, 0), 0);
      if (totalDest < restante) {
        throw new Error(
          `Reversa inválida: no hay suficiente cantidad en proyecto destino para deshacer TRASPASO. Disponible=${totalDest}, requerido=${restante}`
        );
      }

      for (const r of destRows.rows) {
        if (restante <= 0) break;

        const disp = toNumber(r.cantidad, 0);
        const mover = Math.min(restante, disp);

        // decrementa fila destino
        await client.query(`UPDATE public.inventario_asignado SET cantidad = cantidad - $1 WHERE id = $2`, [
          mover,
          r.id,
        ]);

        // suma a origen (mismo sitio de esa fila destino)
        await upsertInventarioAsignado({
          client,
          inventarioId: inv.id,
          proyectoId: po,
          sitioId: r.sitio_id,
          requisicionId: r.requisicion_id ?? null,
          cantidad: mover,
          valorUnitario: r.valor_unitario,
          moneda: r.moneda,
        });

        restante -= mover;
      }

      await insertReversaAudit({
        tipo_movimiento: "TRASPASO",
        proyecto_origen_id: pd,
        proyecto_destino_id: po,
        observacionesExtra: "Reversa de TRASPASO: mueve de destino a origen.",
      });
    } else if (tipo === "ENTRADA") {
      /**
       * ENTRADA: depende de OC:
       * - Si OC.sitio_id == id_sitio_almacen_central => entra a stock_actual
       * - Si no => entra a asignado + inventario_asignado (proyecto/sitio de OC)
       */
      let entraAStock = true;
      let ocSitioId = null;

      if (mov.orden_compra_id) {
        const ocRes = await client.query(
          `SELECT id, sitio_id, proyecto_id FROM public.ordenes_compra WHERE id = $1 LIMIT 1`,
          [mov.orden_compra_id]
        );
        ocSitioId = ocRes.rows[0]?.sitio_id ?? null;

        const almacenCentral = await getParametroSistema(client, "id_sitio_almacen_central");
        if (almacenCentral && ocSitioId !== null) {
          entraAStock = String(ocSitioId) === String(almacenCentral);
        }
      }

      if (entraAStock) {
        // Reversa: quitar de stock
        if (stockActual < cantidad) {
          throw new Error(`Reversa inválida: dejaría stock negativo. Stock=${stockActual}, requerido=${cantidad}`);
        }

        await client.query(
          `
          UPDATE public.inventario_actual
             SET stock_actual = stock_actual - $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [cantidad, inv.id]
        );

        await insertReversaAudit({
          tipo_movimiento: "ENTRADA",
          proyecto_origen_id: null,
          proyecto_destino_id: mov.proyecto_destino_id ?? null,
          observacionesExtra: "Reversa de ENTRADA: se retiró del stock (anulación de recepción).",
        });
      } else {
        // Reversa: quitar de asignado + inventario_asignado (proyecto_destino + sitio OC)
        const proyectoDestino = mov.proyecto_destino_id;
        if (!proyectoDestino) {
          throw new Error("ENTRADA asignada sin proyecto_destino_id. No se puede reversar automáticamente.");
        }
        if (!ocSitioId) {
          // si no pudimos resolver sitio de la OC, intentamos sitio del proyecto
          const pRes = await client.query(`SELECT sitio_id FROM public.proyectos WHERE id = $1 LIMIT 1`, [
            proyectoDestino,
          ]);
          ocSitioId = pRes.rows[0]?.sitio_id ?? null;
        }
        if (!ocSitioId) {
          throw new Error("No se pudo resolver sitio destino para reversa de ENTRADA asignada.");
        }

        if (asignadoActual < cantidad) {
          throw new Error(
            `Reversa inválida: no hay asignado suficiente. Asignado=${asignadoActual}, requerido=${cantidad}`
          );
        }

        await decrementInventarioAsignado({
          client,
          inventarioId: inv.id,
          proyectoId: proyectoDestino,
          sitioId: ocSitioId,
          requisicionId: mov.requisicion_id ?? null,
          cantidad,
        });

        await client.query(
          `
          UPDATE public.inventario_actual
             SET asignado = asignado - $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [cantidad, inv.id]
        );

        await insertReversaAudit({
          tipo_movimiento: "ENTRADA",
          proyecto_origen_id: null,
          proyecto_destino_id: proyectoDestino,
          observacionesExtra: `Reversa de ENTRADA: se retiró de asignado (sitio=${ocSitioId}).`,
        });
      }
    } else if (tipo === "SALIDA") {     
       /**
       * SALIDA puede venir de:
       * - STOCK (proyecto_origen_id NULL)  => revertir sumando a stock_actual
       * - ASIGNADO (proyecto_origen_id NOT NULL) => revertir sumando a asignado + inventario_asignado
       *
       * Regla del negocio: "la reversa debe devolver al lugar de donde salió".
       */

      const proyectoOrigen = mov.proyecto_origen_id;   // <- clave para saber de dónde salió
      const proyectoDestino = mov.proyecto_destino_id; // destino real (auditoría)

      // Caso A) Salida desde STOCK
      if (!proyectoOrigen) {
        // Reversa: regresa a STOCK en la MISMA ubicación física del movimiento
        await client.query(
          `
          UPDATE public.inventario_actual
             SET stock_actual = stock_actual + $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [cantidad, inv.id]
        );

        await insertReversaAudit({
          tipo_movimiento: "SALIDA",
          proyecto_origen_id: null,
          proyecto_destino_id: proyectoDestino ?? null,
          observacionesExtra: "Reversa de SALIDA desde STOCK: regresa a stock_actual.",
        });

      } else {
        // Caso B) Salida desde ASIGNADO
        // Reversa: regresa a ASIGNADO bajo el proyecto_origen_id
        // Sitio: intentamos requisicion.sitio_id (si existe), si no proyectos.sitio_id del proyectoOrigen
        let sitioOrigen = null;

        if (mov.requisicion_id) {
          try {
            const rRes = await client.query(
              `SELECT sitio_id FROM public.requisiciones WHERE id = $1 LIMIT 1`,
              [mov.requisicion_id]
            );
            sitioOrigen = rRes.rows[0]?.sitio_id ?? null;
          } catch (_e) {
            // Si requisiciones no tiene sitio_id, usamos proyecto.sitio_id
          }
        }

        if (!sitioOrigen) {
          const pRes = await client.query(
            `SELECT sitio_id FROM public.proyectos WHERE id = $1 LIMIT 1`,
            [proyectoOrigen]
          );
          sitioOrigen = pRes.rows[0]?.sitio_id ?? null;
        }

        if (!sitioOrigen) {
          throw new Error("No se pudo resolver sitio para reversa de SALIDA desde ASIGNADO.");
        }

        // Sumar a inventario_actual.asignado
        await client.query(
          `
          UPDATE public.inventario_actual
             SET asignado = asignado + $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [cantidad, inv.id]
        );

        // Sumar a inventario_asignado (regresa al proyecto ORIGEN)
        await upsertInventarioAsignado({
          client,
          inventarioId: inv.id,
          proyectoId: proyectoOrigen,
          sitioId: sitioOrigen,
          requisicionId: mov.requisicion_id ?? null,
          cantidad,
          valorUnitario: mov.valor_unitario,
          moneda: mov.moneda,
        });

        await insertReversaAudit({
          tipo_movimiento: "SALIDA",
          proyecto_origen_id: proyectoOrigen,
          proyecto_destino_id: proyectoDestino ?? null,
          observacionesExtra: `Reversa de SALIDA desde ASIGNADO: regresa a asignado (sitio=${sitioOrigen}).`,
        });}
      } else {
      throw new Error(`Tipo de movimiento no soportado para reversa: ${tipo}`);
    }

    // Marcar movimiento original como ANULADO y ligar reversa
    await client.query(
      `
      UPDATE public.movimientos_inventario
         SET estado = 'ANULADO',
             anulado_en = NOW(),
             anulado_por = $1,
             motivo_anulacion = $2
       WHERE id = $3
      `,
      [usuarioId, motivoTxt, movimientoId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, mensaje: "Movimiento reversado/anulado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en reversarMovimiento:", error);
    return res.status(500).json({ error: error.message || "Error interno al reversar movimiento." });
  } finally {
    client.release();
  }
};

/** =========================================================================================
 * Exports
 * ======================================================================================= */
module.exports = {
  getDatosIniciales,
  getInventarioActual,
  getCatalogoResumen,
  getDetalleAsignacionesMaterial,
  getKardex,
  ajustarInventario,
  apartarStock,
  moverAsignacion,
  reversarMovimiento,
};
