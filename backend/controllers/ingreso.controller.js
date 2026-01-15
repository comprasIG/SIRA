// backend/controllers/ingreso.controller.js
const pool = require("../db/pool");

/**
 * INGRESO (Recepción de OC)
 * =========================================================================================
 * Objetivo:
 * - Registrar recepción parcial/total de una OC (ordenes_compra_detalle.cantidad_recibida)
 * - Registrar incidencias (incidencias_recepcion_oc)
 * - Actualizar inventario:
 *    - Si OC.sitio_id == parametros_sistema.id_sitio_almacen_central => entra a DISPONIBLE (stock_actual)
 *    - Si NO => entra directo a APARTADO (asignado + inventario_asignado) a proyecto/sitio de la OC
 * - Registrar Kardex:
 *    - movimientos_inventario tipo_movimiento = 'ENTRADA'
 *
 * IMPORTANTE:
 * - ubicacion_id SIEMPRE es la ubicación física (ubicaciones_almacen.id)
 * - sitio_id NO es ubicación física, es destino final (cliente/espacio)
 */

/** =========================================================================================
 * Helpers
 * ======================================================================================= */

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const s = value.toString().trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

const toTrimmedString = (v) => (v ?? "").toString().trim();

/**
 * Obtiene valor de parametro_sistema.
 * Ej: clave='id_sitio_almacen_central' => '21'
 */
const getParametroSistema = async (client, clave) => {
  const { rows } = await client.query(
    `SELECT valor FROM public.parametros_sistema WHERE clave = $1 LIMIT 1`,
    [clave]
  );
  return rows[0]?.valor ?? null;
};

/**
 * Resuelve una ubicacion_id válida para inventario/kardex.
 * - Si llega ubicacion_id => valida que exista
 * - Si no llega => intenta por codigo 'SIN_UBICACION'
 * - Fallback => primera ubicación existente
 */
const resolveUbicacionId = async (client, ubicacionIdFromBody) => {
  // 1) Si el usuario envió ubicación, validarla
  if (ubicacionIdFromBody) {
    const ex = await client.query(
      `SELECT id FROM public.ubicaciones_almacen WHERE id = $1 LIMIT 1`,
      [ubicacionIdFromBody]
    );
    if (ex.rowCount > 0) return ubicacionIdFromBody;
  }

  // 2) Buscar "SIN_UBICACION"
  const sin = await client.query(
    `
    SELECT id
    FROM public.ubicaciones_almacen
    WHERE upper(codigo) = upper('SIN_UBICACION')
       OR upper(nombre) IN ('SIN UBICACIÓN','SIN UBICACION','SIN_UBICACION')
    ORDER BY id ASC
    LIMIT 1
    `
  );
  if (sin.rowCount > 0) return sin.rows[0].id;

  // 3) Fallback: primera ubicación
  const first = await client.query(
    `SELECT id FROM public.ubicaciones_almacen ORDER BY id ASC LIMIT 1`
  );
  if (first.rowCount > 0) return first.rows[0].id;

  throw new Error(
    "No existen ubicaciones_almacen. Crea al menos una ubicación antes de recepcionar OCs."
  );
};

/**
 * Info base de OC para recepción + regla de almacén central.
 */
const getOcInfoForIngreso = async (client, ocId) => {
  const ocRes = await client.query(
    `
    SELECT
      oc.id,
      oc.numero_oc,
      oc.proyecto_id,
      oc.sitio_id
    FROM public.ordenes_compra oc
    WHERE oc.id = $1
    `,
    [ocId]
  );

  if (ocRes.rowCount === 0) {
    throw new Error(`OC con ID ${ocId} no encontrada.`);
  }

  const oc = ocRes.rows[0];

  const almacenCentral = await getParametroSistema(client, "id_sitio_almacen_central");
  if (!almacenCentral) {
    throw new Error(
      "No está configurado parametros_sistema.id_sitio_almacen_central (ej. valor=21)."
    );
  }

  const entraADisponible = String(oc.sitio_id) === String(almacenCentral);

  return {
    ...oc,
    entraADisponible,
    almacenCentralId: almacenCentral,
  };
};

/** =========================================================================================
 * GET /api/ingreso/ocs-en-proceso
 * ======================================================================================= */
const getOcsEnProceso = async (req, res) => {
  const { departamentoId, sitioId, proyectoId, proveedorId, search } = req.query;

  // ✅ Cambio importante:
  // Traemos el parámetro del sistema (si existe) y devolvemos:
  // - almacen_central_id
  // - entra_a_disponible = true/false (regla real, no por nombre de proyecto)
  let query = `
        SELECT
            oc.id,
            oc.numero_oc,
            oc.total,
            oc.actualizado_en AS fecha_ultimo_movimiento,
            oc.status,
            oc.entrega_parcial,
            oc.con_incidencia,

            p.marca AS proveedor_marca,
            p.razon_social AS proveedor_razon_social,

            pr.nombre AS proyecto_nombre,
            s.nombre AS sitio_nombre,
            d.nombre AS departamento_nombre,

            oc.metodo_recoleccion_id,
            cmr.nombre AS metodo_recoleccion_nombre,
            oc.entrega_responsable,

            r.departamento_id,
            oc.sitio_id,
            oc.proyecto_id,
            oc.proveedor_id,

            ps.almacen_central_id,
            CASE
              WHEN ps.almacen_central_id IS NULL THEN false
              ELSE (oc.sitio_id = ps.almacen_central_id)
            END AS entra_a_disponible

        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        JOIN proyectos pr ON oc.proyecto_id = pr.id
        JOIN sitios s ON oc.sitio_id = s.id
        JOIN requisiciones r ON oc.rfq_id = r.id
        JOIN departamentos d ON r.departamento_id = d.id
        LEFT JOIN catalogo_metodos_recoleccion cmr ON oc.metodo_recoleccion_id = cmr.id

        -- Parametro del sistema (si no existe, almacen_central_id queda NULL)
        LEFT JOIN LATERAL (
          SELECT NULLIF(valor, '')::int AS almacen_central_id
          FROM public.parametros_sistema
          WHERE clave = 'id_sitio_almacen_central'
          LIMIT 1
        ) ps ON true

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
    query += ` AND (oc.numero_oc ILIKE $${paramIndex} OR p.marca ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY oc.actualizado_en DESC`;

  try {
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (error) {
    console.error("Error fetching OCs EN_PROCESO:", error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * GET /api/ingreso/datos-iniciales
 * ======================================================================================= */
const getDatosIniciales = async (req, res) => {
  try {
    const kpiQuery = `
            SELECT
                COUNT(*) AS total_en_proceso,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'LOCAL') AND entrega_responsable = 'PROVEEDOR') AS kpi_proveedor_entrega,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'PAQUETERIA')) AS kpi_paqueteria,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'LOCAL') AND entrega_responsable = 'EQUIPO_RECOLECCION') AS kpi_equipo_recoleccion,
                COUNT(*) FILTER (WHERE entrega_parcial = true) AS kpi_parciales,
                COUNT(*) FILTER (WHERE con_incidencia = true) AS kpi_con_incidencia
            FROM ordenes_compra WHERE status = 'EN_PROCESO';
        `;
    const proveedoresQuery = `SELECT DISTINCT p.id, p.marca FROM proveedores p JOIN ordenes_compra oc ON p.id = oc.proveedor_id WHERE oc.status = 'EN_PROCESO' ORDER BY p.marca ASC`;
    const sitiosQuery = `SELECT DISTINCT s.id, s.nombre FROM sitios s JOIN ordenes_compra oc ON s.id = oc.sitio_id WHERE oc.status = 'EN_PROCESO' ORDER BY s.nombre ASC`;
    const proyectosQuery = `SELECT DISTINCT pr.id, pr.nombre, pr.sitio_id FROM proyectos pr JOIN ordenes_compra oc ON pr.id = oc.proyecto_id WHERE oc.status = 'EN_PROCESO' ORDER BY pr.nombre ASC`;
    const departamentosQuery = `SELECT DISTINCT d.id, d.nombre FROM departamentos d JOIN requisiciones r ON d.id = r.departamento_id JOIN ordenes_compra oc ON r.id = oc.rfq_id WHERE oc.status = 'EN_PROCESO' ORDER BY d.nombre ASC`;
    const ubicacionesQuery = `SELECT id, codigo, nombre FROM ubicaciones_almacen ORDER BY nombre ASC`;
    const incidenciasQuery = `SELECT id, codigo, descripcion, activo FROM catalogo_incidencias_recepcion ORDER BY descripcion ASC`;

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

    return res.json({
      kpis: kpiRes.rows[0] || {},
      filterOptions: {
        proveedores: proveedoresRes.rows,
        sitios: sitiosRes.rows,
        proyectos: proyectosRes.rows,
        departamentos: departamentosRes.rows,
        ubicacionesAlmacen: ubicacionesRes.rows,
        tiposIncidencia: incidenciasRes.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching initial data for ING_OC:", error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * GET /api/ingreso/oc/:id/detalles
 * ======================================================================================= */
const getOcDetalleParaIngreso = async (req, res) => {
  const { id: ordenCompraId } = req.params;
  try {
    const query = `
            SELECT 
                ocd.id AS detalle_id,
                ocd.material_id,
                cm.sku AS sku,
                cm.nombre AS material_nombre,
                cu.simbolo AS unidad_simbolo,
                ocd.cantidad AS cantidad_pedida,
                ocd.cantidad_recibida,
                ocd.precio_unitario,
                ocd.moneda
            FROM public.ordenes_compra_detalle ocd
            JOIN public.catalogo_materiales cm ON ocd.material_id = cm.id
            JOIN public.catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE ocd.orden_compra_id = $1
            ORDER BY ocd.id ASC;
        `;

    const { rows } = await pool.query(query, [ordenCompraId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Detalles no encontrados para esta OC." });
    }
    return res.json(rows);
  } catch (error) {
    console.error(`Error fetching details for OC ${ordenCompraId}:`, error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * POST /api/ingreso/registrar
 * ======================================================================================= */
const registrarIngreso = async (req, res) => {
  const { orden_compra_id, items, ubicacion_id } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!orden_compra_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Datos de ingreso inválidos." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ocInfo = await getOcInfoForIngreso(client, orden_compra_id);
    const ubicacionIdFinal = await resolveUbicacionId(client, ubicacion_id);

    let hasAnyPartial = false;
    const ingresoDetalles = [];

    for (const item of items) {
      const { detalle_id, material_id, cantidad_ingresada_ahora, incidencia } = item;

      const cantidadNum = toNumber(cantidad_ingresada_ahora, 0);
      if (cantidadNum < 0) continue;

      // Precio/Moneda: preferimos lo que venga del frontend; si no, lo tomamos del detalle.
      const precioUnitarioFromBody = toNumber(item?.precio_unitario, NaN);
      const monedaFromBody = toTrimmedString(item?.moneda).toUpperCase();

      // 1) Update detalle OC
      let updatedDetail = null;

      if (cantidadNum > 0 || (incidencia && incidencia.tipo_id)) {
        const updateDetailQuery = `
          UPDATE public.ordenes_compra_detalle
             SET cantidad_recibida = cantidad_recibida + $1
           WHERE id = $2
             AND orden_compra_id = $3
         RETURNING
             id,
             cantidad,
             cantidad_recibida,
             requisicion_detalle_id,
             precio_unitario,
             moneda;
        `;
        const detailRes = await client.query(updateDetailQuery, [
          cantidadNum,
          detalle_id,
          orden_compra_id,
        ]);
        if (detailRes.rowCount === 0) {
          throw new Error(
            `Detalle ID ${detalle_id} no encontrado o no pertenece a OC ${orden_compra_id}.`
          );
        }

        updatedDetail = detailRes.rows[0];

        if (toNumber(updatedDetail.cantidad_recibida, 0) < toNumber(updatedDetail.cantidad, 0)) {
          hasAnyPartial = true;
        }
      }

      // 2) Incidencias
      if (incidencia && incidencia.tipo_id && incidencia.descripcion) {
        const incidentQuery = `
          INSERT INTO public.incidencias_recepcion_oc
            (orden_compra_id, incidencia_id, cantidad_afectada, descripcion_problema, usuario_id, material_id)
          VALUES
            ($1, $2, $3, $4, $5, $6)
          RETURNING id;
        `;

        await client.query(incidentQuery, [
          orden_compra_id,
          incidencia.tipo_id,
          incidencia.cantidad_afectada || null,
          incidencia.descripcion,
          usuarioId,
          material_id,
        ]);

        ingresoDetalles.push({ detalle_id, material_id, incidencia: true, ...incidencia });
      }

      // 3) Sin ingreso real, continuar
      if (cantidadNum <= 0) continue;

      // Precio/moneda finales (regla: “último precio de entrada”)
      const precioDetalle = toNumber(updatedDetail?.precio_unitario, 0);
      const monedaDetalle = toTrimmedString(updatedDetail?.moneda).toUpperCase();

      const precioFinal =
        Number.isFinite(precioUnitarioFromBody) && precioUnitarioFromBody > 0
          ? precioUnitarioFromBody
          : precioDetalle;

      const monedaFinal =
        monedaFromBody && monedaFromBody.length === 3
          ? monedaFromBody
          : (monedaDetalle && monedaDetalle.length === 3 ? monedaDetalle : null);

      // 4) Inventario + Kardex
      if (ocInfo.entraADisponible) {
        // DISPONIBLE (stock_actual)
        const stockUpdateQuery = `
          INSERT INTO public.inventario_actual
            (material_id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda)
          VALUES
            ($1, $2, $3, $4, $5)
          ON CONFLICT (material_id, ubicacion_id) DO UPDATE
            SET stock_actual = public.inventario_actual.stock_actual + EXCLUDED.stock_actual,
                ultimo_precio_entrada = EXCLUDED.ultimo_precio_entrada,
                moneda = EXCLUDED.moneda,
                actualizado_en = NOW();
        `;
        await client.query(stockUpdateQuery, [
          material_id,
          ubicacionIdFinal,
          cantidadNum,
          precioFinal,
          monedaFinal,
        ]);

        await client.query(
          `
          INSERT INTO public.movimientos_inventario
            (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
             proyecto_destino_id, orden_compra_id, valor_unitario, moneda, observaciones)
          VALUES
            ($1, 'ENTRADA', $2, $3, $4,
             $5, $6, $7, $8, $9)
          `,
          [
            material_id,
            cantidadNum,
            usuarioId,
            ubicacionIdFinal,
            ocInfo.proyecto_id,
            orden_compra_id,
            precioFinal,
            monedaFinal,
            `Ingreso por OC (DISPONIBLE/ALMACÉN CENTRAL=${ocInfo.almacenCentralId}) - DetalleOC:${detalle_id}`,
          ]
        );

        ingresoDetalles.push({
          detalle_id,
          material_id,
          cantidad: cantidadNum,
          entraADisponible: true,
          ubicacion_id: ubicacionIdFinal,
        });
      } else {
        // DIRECTO A APARTADO
        const assignedUpdateQuery = `
          INSERT INTO public.inventario_actual
            (material_id, ubicacion_id, asignado, ultimo_precio_entrada, moneda)
          VALUES
            ($1, $2, $3, $4, $5)
          ON CONFLICT (material_id, ubicacion_id) DO UPDATE
            SET asignado = public.inventario_actual.asignado + EXCLUDED.asignado,
                ultimo_precio_entrada = EXCLUDED.ultimo_precio_entrada,
                moneda = EXCLUDED.moneda,
                actualizado_en = NOW()
          RETURNING id;
        `;

        const invActualRes = await client.query(assignedUpdateQuery, [
          material_id,
          ubicacionIdFinal,
          cantidadNum,
          precioFinal,
          monedaFinal,
        ]);

        const inventarioId = invActualRes.rows[0].id;

        const requisicionPrincipalQuery = `
          SELECT r.id AS requisicion_principal_id
          FROM public.requisiciones_detalle rd
          JOIN public.requisiciones r ON rd.requisicion_id = r.id
          WHERE rd.id = $1
          LIMIT 1;
        `;
        const reqPrincipalRes = await client.query(requisicionPrincipalQuery, [
          updatedDetail?.requisicion_detalle_id,
        ]);
        if (reqPrincipalRes.rowCount === 0) {
          throw new Error(
            `No se pudo encontrar la requisición principal para DetalleOC:${detalle_id} (ReqDetID:${updatedDetail?.requisicion_detalle_id})`
          );
        }

        const { requisicion_principal_id } = reqPrincipalRes.rows[0];

        const assignedInsertQuery = `
          INSERT INTO public.inventario_asignado
            (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, NOW());
        `;
        await client.query(assignedInsertQuery, [
          inventarioId,
          requisicion_principal_id,
          ocInfo.proyecto_id,
          ocInfo.sitio_id,
          cantidadNum,
          precioFinal,
          monedaFinal,
        ]);

        await client.query(
          `
          INSERT INTO public.movimientos_inventario
            (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
             proyecto_destino_id, orden_compra_id, requisicion_id, valor_unitario, moneda, observaciones)
          VALUES
            ($1, 'ENTRADA', $2, $3, $4,
             $5, $6, $7, $8, $9, $10)
          `,
          [
            material_id,
            cantidadNum,
            usuarioId,
            ubicacionIdFinal,
            ocInfo.proyecto_id,
            orden_compra_id,
            requisicion_principal_id,
            precioFinal,
            monedaFinal,
            `Ingreso por OC (DIRECTO A APARTADO) - destino sitio=${ocInfo.sitio_id} proyecto=${ocInfo.proyecto_id} - DetalleOC:${detalle_id}`,
          ]
        );

        ingresoDetalles.push({
          detalle_id,
          material_id,
          cantidad: cantidadNum,
          entraADisponible: false,
          ubicacion_id: ubicacionIdFinal,
          sitio_destino: ocInfo.sitio_id,
          proyecto_destino: ocInfo.proyecto_id,
          requisicion_id: requisicion_principal_id,
        });
      }
    }

    // Flags OC
    const checkIncidentQuery = `
      SELECT EXISTS (
        SELECT 1 FROM public.incidencias_recepcion_oc WHERE orden_compra_id = $1
      ) AS has_incident
    `;
    const incidentCheckRes = await client.query(checkIncidentQuery, [orden_compra_id]);
    const finalIncidentFlag = !!incidentCheckRes.rows[0]?.has_incident;
    const finalPartialFlag = !!hasAnyPartial;

    await client.query(
      `
      UPDATE public.ordenes_compra
         SET con_incidencia = $1,
             entrega_parcial = $2,
             actualizado_en = NOW()
       WHERE id = $3;
      `,
      [finalIncidentFlag, finalPartialFlag, orden_compra_id]
    );

    // Historial OC
    await client.query(
      `
      INSERT INTO public.ordenes_compra_historial
        (orden_compra_id, usuario_id, accion_realizada, detalles)
      VALUES
        ($1, $2, 'REGISTRO_INGRESO', $3)
      `,
      [
        orden_compra_id,
        usuarioId,
        JSON.stringify({
          itemsProcesados: ingresoDetalles,
          ubicacionFisica: ubicacionIdFinal,
          entraADisponible: ocInfo.entraADisponible,
          almacenCentralId: ocInfo.almacenCentralId,
        }),
      ]
    );

    await client.query("COMMIT");
    return res.status(200).json({ mensaje: "Ingreso registrado exitosamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando ingreso OC:", error);
    return res
      .status(500)
      .json({ error: error.message || "Error interno al registrar el ingreso." });
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
