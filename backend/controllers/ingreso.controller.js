// backend/controllers/ingreso.controller.js
const pool = require('../db/pool');

/**
 * ============================================================================
 * Helpers: Parámetros del sistema + Ubicación por defecto ("SIN UBICACIÓN")
 * ============================================================================
 */
const PARAM_CLAVE_SITIO_ALMACEN_CENTRAL = 'id_sitio_almacen_central';
const UBICACION_CODIGO_SIN_UBICACION = 'SIN_UBICACION';

let _cache = {
  sitioAlmacenCentralId: null,
  sitioAlmacenCentralLoadedAt: 0,
  sinUbicacionId: null,
  sinUbicacionLoadedAt: 0,
};

const CACHE_MS = 60_000;

async function getParametroSistemaInt(client, clave) {
  const q = `SELECT valor FROM public.parametros_sistema WHERE clave = $1`;
  const { rows } = await client.query(q, [clave]);
  if (!rows.length) return null;
  const n = parseInt(rows[0].valor, 10);
  return Number.isFinite(n) ? n : null;
}

async function getSitioAlmacenCentralId(client) {
  const now = Date.now();
  if (_cache.sitioAlmacenCentralId && (now - _cache.sitioAlmacenCentralLoadedAt) < CACHE_MS) {
    return _cache.sitioAlmacenCentralId;
  }
  const id = await getParametroSistemaInt(client, PARAM_CLAVE_SITIO_ALMACEN_CENTRAL);
  if (!id) {
    throw new Error(
      `Parámetro faltante o inválido: parametros_sistema.clave='${PARAM_CLAVE_SITIO_ALMACEN_CENTRAL}'`
    );
  }
  _cache.sitioAlmacenCentralId = id;
  _cache.sitioAlmacenCentralLoadedAt = now;
  return id;
}

async function getSinUbicacionId(client) {
  const now = Date.now();
  if (_cache.sinUbicacionId && (now - _cache.sinUbicacionLoadedAt) < CACHE_MS) {
    return _cache.sinUbicacionId;
  }

  const q1 = `
    SELECT id
    FROM public.ubicaciones_almacen
    WHERE upper(codigo) = upper($1)
    ORDER BY id ASC
    LIMIT 1
  `;
  const r1 = await client.query(q1, [UBICACION_CODIGO_SIN_UBICACION]);
  if (r1.rows.length) {
    _cache.sinUbicacionId = r1.rows[0].id;
    _cache.sinUbicacionLoadedAt = now;
    return _cache.sinUbicacionId;
  }

  const q2 = `
    SELECT id
    FROM public.ubicaciones_almacen
    WHERE upper(nombre) IN ('SIN UBICACIÓN', 'SIN UBICACION', 'SIN_UBICACION')
    ORDER BY id ASC
    LIMIT 1
  `;
  const r2 = await client.query(q2);
  if (!r2.rows.length) {
    throw new Error(
      `No existe ubicación default. Ejecuta la migración de SIN_UBICACION o crea una en ubicaciones_almacen.`
    );
  }

  _cache.sinUbicacionId = r2.rows[0].id;
  _cache.sinUbicacionLoadedAt = now;
  return _cache.sinUbicacionId;
}

async function resolveUbicacionFisicaId(client, ubicacionIdFromBody) {
  const n =
    ubicacionIdFromBody === null || ubicacionIdFromBody === undefined
      ? null
      : parseInt(ubicacionIdFromBody, 10);

  if (Number.isFinite(n) && n > 0) return n;
  return await getSinUbicacionId(client);
}

/**
 * ============================================================================
 * Upserts SIN ON CONFLICT (porque no hay UNIQUE en STG)
 * ============================================================================
 */

async function upsertInventarioActualStock(client, { materialId, ubicacionId, cantidad, precioUnitario, moneda }) {
  const sel = `
    SELECT id
    FROM public.inventario_actual
    WHERE material_id = $1 AND ubicacion_id = $2
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `;
  const rSel = await client.query(sel, [materialId, ubicacionId]);

  if (rSel.rows.length) {
    const id = rSel.rows[0].id;
    const upd = `
      UPDATE public.inventario_actual
      SET stock_actual = COALESCE(stock_actual, 0) + $1,
          ultimo_precio_entrada = $2,
          moneda = $3,
          actualizado_en = NOW()
      WHERE id = $4
      RETURNING id;
    `;
    await client.query(upd, [cantidad, precioUnitario, moneda, id]);
    return id;
  }

  const ins = `
    INSERT INTO public.inventario_actual (material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda, actualizado_en)
    VALUES ($1, $2, $3, 0, $4, $5, NOW())
    RETURNING id;
  `;
  const rIns = await client.query(ins, [materialId, ubicacionId, cantidad, precioUnitario, moneda]);
  return rIns.rows[0].id;
}

async function upsertInventarioActualAsignado(client, { materialId, ubicacionId, cantidad }) {
  const sel = `
    SELECT id
    FROM public.inventario_actual
    WHERE material_id = $1 AND ubicacion_id = $2
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `;
  const rSel = await client.query(sel, [materialId, ubicacionId]);

  if (rSel.rows.length) {
    const id = rSel.rows[0].id;
    const upd = `
      UPDATE public.inventario_actual
      SET asignado = COALESCE(asignado, 0) + $1,
          actualizado_en = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    await client.query(upd, [cantidad, id]);
    return id;
  }

  const ins = `
    INSERT INTO public.inventario_actual (material_id, ubicacion_id, stock_actual, asignado, actualizado_en)
    VALUES ($1, $2, 0, $3, NOW())
    RETURNING id;
  `;
  const rIns = await client.query(ins, [materialId, ubicacionId, cantidad]);
  return rIns.rows[0].id;
}

async function upsertInventarioAsignado(client, { inventarioId, requisicionId, proyectoId, sitioId, cantidad, valorUnitario, moneda }) {
  const sel = `
    SELECT id
    FROM public.inventario_asignado
    WHERE inventario_id = $1
      AND requisicion_id = $2
      AND proyecto_id = $3
      AND sitio_id = $4
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `;
  const rSel = await client.query(sel, [inventarioId, requisicionId, proyectoId, sitioId]);

  if (rSel.rows.length) {
    const id = rSel.rows[0].id;
    const upd = `
      UPDATE public.inventario_asignado
      SET cantidad = COALESCE(cantidad, 0) + $1,
          valor_unitario = $2,
          moneda = $3,
          asignado_en = NOW()
      WHERE id = $4
      RETURNING id;
    `;
    await client.query(upd, [cantidad, valorUnitario, moneda, id]);
    return id;
  }

  const ins = `
    INSERT INTO public.inventario_asignado
      (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id;
  `;
  const rIns = await client.query(ins, [inventarioId, requisicionId, proyectoId, sitioId, cantidad, valorUnitario, moneda]);
  return rIns.rows[0].id;
}

/**
 * ============================================================================
 * Helper: Obtener info base de OC para el flujo de ingreso
 * ============================================================================
 */
const getOcInfoForIngreso = async (client, ocId) => {
  const query = `
    SELECT
      oc.id, oc.numero_oc, oc.proyecto_id, oc.sitio_id,
      pr.nombre AS proyecto_nombre
    FROM ordenes_compra oc
    JOIN proyectos pr ON oc.proyecto_id = pr.id
    WHERE oc.id = $1
  `;
  const res = await client.query(query, [ocId]);
  if (res.rowCount === 0) {
    throw new Error(`OC con ID ${ocId} no encontrada.`);
  }

  const sitioAlmacenCentralId = await getSitioAlmacenCentralId(client);
  const isStockOc = Number(res.rows[0].sitio_id) === Number(sitioAlmacenCentralId);

  return { ...res.rows[0], sitioAlmacenCentralId, isStockOc };
};

/**
 * ============================================================================
 * GET /api/ingreso/ocs-en-proceso
 * ============================================================================
 */
const getOcsEnProceso = async (req, res) => {
  const { departamentoId, sitioId, proyectoId, proveedorId, search } = req.query;
  let query = `
    SELECT
      oc.id, oc.numero_oc, oc.total, oc.actualizado_en AS fecha_ultimo_movimiento,
      oc.status, oc.entrega_parcial, oc.con_incidencia,
      p.marca AS proveedor_marca, p.razon_social AS proveedor_razon_social,
      pr.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, d.nombre AS departamento_nombre,
      oc.metodo_recoleccion_id, cmr.nombre AS metodo_recoleccion_nombre, oc.entrega_responsable,
      r.departamento_id, oc.sitio_id, oc.proyecto_id, oc.proveedor_id
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN proyectos pr ON oc.proyecto_id = pr.id
    JOIN sitios s ON oc.sitio_id = s.id
    JOIN requisiciones r ON oc.rfq_id = r.id
    JOIN departamentos d ON r.departamento_id = d.id
    LEFT JOIN catalogo_metodos_recoleccion cmr ON oc.metodo_recoleccion_id = cmr.id
    WHERE oc.status = 'EN_PROCESO'
  `;
  const params = [];
  let paramIndex = 1;

  if (departamentoId) {
    query += ` AND r.departamento_id = $${paramIndex++}`;
    params.push(departamentoId);
  }
  if (sitioId) {
    query += ` AND oc.sitio_id = $${paramIndex++}`;
    params.push(sitioId);
  }
  if (proyectoId) {
    query += ` AND oc.proyecto_id = $${paramIndex++}`;
    params.push(proyectoId);
  }
  if (proveedorId) {
    query += ` AND oc.proveedor_id = $${paramIndex++}`;
    params.push(proveedorId);
  }
  if (search) {
    query += ` AND (oc.numero_oc ILIKE $${paramIndex++} OR p.marca ILIKE $${paramIndex} OR p.razon_social ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY oc.actualizado_en DESC`;

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error en getOcsEnProceso:', error);
    res.status(500).json({ error: 'Error interno al obtener OCs en proceso.' });
  }
};

/**
 * ============================================================================
 * GET /api/ingreso/datos-iniciales
 * ============================================================================
 */
const getDatosIniciales = async (req, res) => {
  try {
    const kpiQuery = `
      SELECT
        COUNT(*)::int AS total_en_proceso,
        COUNT(*) FILTER (WHERE entrega_responsable = 'PROVEEDOR')::int AS kpi_proveedor_entrega,
        COUNT(*) FILTER (
          WHERE metodo_recoleccion_id = (
            SELECT id FROM public.catalogo_metodos_recoleccion
            WHERE codigo = 'PAQUETERIA'
            LIMIT 1
          )
        )::int AS kpi_paqueteria,
        COUNT(*) FILTER (WHERE entrega_responsable = 'EQUIPO_RECOLECCION')::int AS kpi_equipo_recoleccion,
        COUNT(*) FILTER (WHERE entrega_parcial = true)::int AS kpi_parciales,
        COUNT(*) FILTER (WHERE con_incidencia = true)::int AS kpi_con_incidencia
      FROM public.ordenes_compra
      WHERE status = 'EN_PROCESO';
    `;

    const proveedoresQuery = `
      SELECT DISTINCT p.id, p.marca
      FROM public.ordenes_compra oc
      JOIN public.proveedores p ON p.id = oc.proveedor_id
      WHERE oc.status = 'EN_PROCESO'
      ORDER BY p.marca ASC
    `;

    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre
      FROM public.ordenes_compra oc
      JOIN public.sitios s ON s.id = oc.sitio_id
      WHERE oc.status = 'EN_PROCESO'
      ORDER BY s.nombre ASC
    `;

    const proyectosQuery = `
      SELECT DISTINCT pr.id, pr.nombre
      FROM public.ordenes_compra oc
      JOIN public.proyectos pr ON pr.id = oc.proyecto_id
      WHERE oc.status = 'EN_PROCESO'
      ORDER BY pr.nombre ASC
    `;

    const departamentosQuery = `
      SELECT DISTINCT d.id, d.nombre
      FROM public.ordenes_compra oc
      JOIN public.requisiciones r ON r.id = oc.rfq_id
      JOIN public.departamentos d ON d.id = r.departamento_id
      WHERE oc.status = 'EN_PROCESO'
      ORDER BY d.nombre ASC
    `;

    const ubicacionesQuery = `
      SELECT id, codigo, nombre
      FROM public.ubicaciones_almacen
      ORDER BY nombre ASC
    `;

    const incidenciasQuery = `
      SELECT id, codigo, descripcion
      FROM public.catalogo_incidencias_recepcion
      WHERE activo = true
      ORDER BY descripcion ASC
    `;

    const [
      kpiRes,
      proveedoresRes,
      sitiosRes,
      proyectosRes,
      departamentosRes,
      ubicacionesRes,
      incidenciasRes,
    ] = await Promise.all([
      pool.query(kpiQuery),
      pool.query(proveedoresQuery),
      pool.query(sitiosQuery),
      pool.query(proyectosQuery),
      pool.query(departamentosQuery),
      pool.query(ubicacionesQuery),
      pool.query(incidenciasQuery),
    ]);

    res.json({
      kpis: kpiRes.rows[0] || {
        total_en_proceso: 0,
        kpi_proveedor_entrega: 0,
        kpi_paqueteria: 0,
        kpi_equipo_recoleccion: 0,
        kpi_parciales: 0,
        kpi_con_incidencia: 0,
      },
      proveedores: proveedoresRes.rows,
      sitios: sitiosRes.rows,
      proyectos: proyectosRes.rows,
      departamentos: departamentosRes.rows,
      ubicaciones: ubicacionesRes.rows,
      incidencias: incidenciasRes.rows,
    });
  } catch (error) {
    console.error('Error en getDatosIniciales:', error);
    res.status(500).json({ error: 'Error interno al obtener datos iniciales.' });
  }
};

/**
 * ============================================================================
 * GET /api/ingreso/oc/:id/detalle
 * ============================================================================
 */
const getOcDetalleParaIngreso = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const query = `
      SELECT 
        ocd.id AS detalle_id, ocd.material_id, cm.nombre AS material_nombre,
        cu.simbolo AS unidad_simbolo, ocd.cantidad AS cantidad_pedida, 
        ocd.cantidad_recibida,
        ocd.precio_unitario, ocd.moneda
      FROM ordenes_compra_detalle ocd
      JOIN catalogo_materiales cm ON ocd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ocd.orden_compra_id = $1
      ORDER BY ocd.id ASC;
    `;
    const { rows } = await pool.query(query, [ordenCompraId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Detalles no encontrados para esta OC.' });
    }
    res.json(rows);
  } catch (error) {
    console.error(`Error fetching details for OC ${ordenCompraId}:`, error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
};

/**
 * ============================================================================
 * POST /api/ingreso/registrar
 * ============================================================================
 */
const registrarIngreso = async (req, res) => {
  const { orden_compra_id, items, ubicacion_id } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!orden_compra_id) {
    return res.status(400).json({ error: 'orden_compra_id es requerido.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es requerido y debe tener al menos 1 elemento.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocInfo = await getOcInfoForIngreso(client, orden_compra_id);
    const { proyecto_id: ocProyectoId, sitio_id: ocSitioId, isStockOc } = ocInfo;

    const ubicacionFisicaId = await resolveUbicacionFisicaId(client, ubicacion_id);

    for (const item of items) {
      const {
        detalle_id,
        material_id,
        cantidad_ingresada_ahora,
        precio_unitario,
        moneda,
        incidencia,
      } = item;

      const cantidadNum = Number(cantidad_ingresada_ahora || 0);
      const valorUnitarioNum = Number(precio_unitario || 0);
      const valorTotalNum = Number.isFinite(cantidadNum) && Number.isFinite(valorUnitarioNum)
        ? cantidadNum * valorUnitarioNum
        : 0;

      if (!detalle_id || !material_id) {
        throw new Error('Cada item debe incluir detalle_id y material_id.');
      }
      if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
        continue;
      }
      if (!Number.isFinite(valorUnitarioNum) || valorUnitarioNum < 0) {
        throw new Error(`precio_unitario inválido para material_id=${material_id}`);
      }

      const updateDetalleQuery = `
        UPDATE ordenes_compra_detalle
        SET cantidad_recibida = COALESCE(cantidad_recibida, 0) + $1,
            actualizado_en = NOW()
        WHERE id = $2
        RETURNING id, orden_compra_id, requisicion_detalle_id, precio_unitario, moneda;
      `;
      const updatedDetailRes = await client.query(updateDetalleQuery, [cantidadNum, detalle_id]);
      if (updatedDetailRes.rowCount === 0) {
        throw new Error(`No se encontró detalle de OC con id=${detalle_id}`);
      }
      const updatedDetail = updatedDetailRes.rows[0];

      if (incidencia && incidencia.id) {
        // Hook para incidencias (depende de tu tabla exacta)
      }

      if (isStockOc) {
        await upsertInventarioActualStock(client, {
          materialId: material_id,
          ubicacionId: ubicacionFisicaId,
          cantidad: cantidadNum,
          precioUnitario: valorUnitarioNum,
          moneda,
        });

        // FIX: movimientos_inventario usa valor_unitario y valor_total (no costo_unitario)
        const movimientoQuery = `
          INSERT INTO movimientos_inventario
            (material_id, tipo_movimiento, cantidad, fecha, orden_compra_id, proyecto_origen_id, proyecto_destino_id, usuario_id, ubicacion_id, valor_unitario, valor_total, moneda)
          VALUES
            ($1, 'ENTRADA', $2, NOW(), $3, NULL, $4, $5, $6, $7, $8, $9);
        `;
        await client.query(movimientoQuery, [
          material_id,
          cantidadNum,
          orden_compra_id,
          ocProyectoId,
          usuarioId,
          ubicacionFisicaId,
          valorUnitarioNum,
          valorTotalNum,
          moneda,
        ]);
      } else {
        const inventarioId = await upsertInventarioActualAsignado(client, {
          materialId: material_id,
          ubicacionId: ubicacionFisicaId,
          cantidad: cantidadNum,
        });

        const requisicionPrincipalQuery = `
          SELECT r.id AS requisicion_principal_id
          FROM requisiciones_detalle rd
          JOIN requisiciones r ON rd.requisicion_id = r.id
          WHERE rd.id = $1;
        `;
        const reqPrincipalRes = await client.query(requisicionPrincipalQuery, [
          updatedDetail.requisicion_detalle_id,
        ]);
        if (reqPrincipalRes.rowCount === 0) {
          throw new Error(
            `No se pudo encontrar requisición principal para ReqDetID=${updatedDetail.requisicion_detalle_id}`
          );
        }
        const { requisicion_principal_id } = reqPrincipalRes.rows[0];

        await upsertInventarioAsignado(client, {
          inventarioId,
          requisicionId: requisicion_principal_id,
          proyectoId: ocProyectoId,
          sitioId: ocSitioId,
          cantidad: cantidadNum,
          valorUnitario: valorUnitarioNum,
          moneda,
        });

        // FIX: movimientos_inventario usa valor_unitario y valor_total
        const movimientoQuery = `
          INSERT INTO movimientos_inventario
            (material_id, tipo_movimiento, cantidad, fecha, orden_compra_id, requisicion_id, proyecto_origen_id, proyecto_destino_id, usuario_id, ubicacion_id, valor_unitario, valor_total, moneda)
          VALUES
            ($1, 'ENTRADA', $2, NOW(), $3, $4, NULL, $5, $6, $7, $8, $9, $10);
        `;
        await client.query(movimientoQuery, [
          material_id,
          cantidadNum,
          orden_compra_id,
          requisicion_principal_id,
          ocProyectoId,
          usuarioId,
          ubicacionFisicaId,
          valorUnitarioNum,
          valorTotalNum,
          moneda,
        ]);
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Ingreso registrado exitosamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando ingreso OC:', error);
    res.status(500).json({ error: error.message || 'Error interno al registrar el ingreso.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getOcsEnProceso,
  getDatosIniciales,
  getOcDetalleParaIngreso,
  registrarIngreso,
};
