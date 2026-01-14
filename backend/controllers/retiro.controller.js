// backend/controllers/retiro.controller.js
const pool = require("../db/pool");

/**
 * RETIRO (PICK_IN) - Salidas físicas de almacén
 * =========================================================================================
 * Objetivos:
 * - Registrar una "SALIDA DE ALMACÉN" (cabecera) totalmente auditable.
 * - Registrar sus items (detalle).
 * - Registrar los movimientos en kardex (movimientos_inventario) y ligar todo con salida_almacen_id.
 *
 * Reglas acordadas:
 * - Siempre se registra "solicitante" (empleado_id) seleccionado desde /empleados (status_laboral=activo).
 * - Hay 2 tipos:
 *   A) ASIGNADO: sale de inventario_asignado (apartado) y descuenta inventario_actual.asignado.
 *      * Destino NO se captura (opción 1): se entiende que es consumo del mismo proyecto/sitio origen.
 *      * En kardex: proyecto_origen_id = proyecto de la asignación, proyecto_destino_id = NULL.
 *      * asignacion_origen_id SIEMPRE se guarda para reversas finas.
 *
 *   B) STOCK: sale de inventario_actual.stock_actual y requiere destino (sitio/proyecto).
 *      * En kardex: proyecto_origen_id = NULL, proyecto_destino_id = proyecto destino.
 *
 * Valuación:
 * - valor_unitario = inventario_actual.ultimo_precio_entrada (fallback a 0).
 * - moneda = inventario_actual.moneda (nullable).
 */

// --------------------------
// Helpers
// --------------------------
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toInt = (v, def = null) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

/** =========================================================================================
 * GET /api/retiro/datos-filtros
 * ======================================================================================= */
const getDatosFiltrosRetiro = async (req, res) => {
  try {
    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre
      FROM sitios s
      JOIN inventario_asignado ia ON s.id = ia.sitio_id
      WHERE ia.cantidad > 0
      ORDER BY s.nombre ASC;
    `;

    const proyectosQuery = `
      SELECT DISTINCT p.id, p.nombre, p.sitio_id
      FROM proyectos p
      JOIN inventario_asignado ia ON p.id = ia.proyecto_id
      WHERE ia.cantidad > 0
      ORDER BY p.nombre ASC;
    `;

    const materialesStockQuery = `
      SELECT
        cm.id,
        cm.nombre,
        cu.simbolo AS unidad_simbolo,
        SUM(ia.stock_actual) AS stock_total
      FROM catalogo_materiales cm
      JOIN inventario_actual ia ON cm.id = ia.material_id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ia.stock_actual > 0
      GROUP BY cm.id, cm.nombre, cu.simbolo
      ORDER BY cm.nombre ASC;
    `;

    const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM proyectos ORDER BY nombre ASC`;
    const todosSitiosQuery = `SELECT id, nombre FROM sitios ORDER BY nombre ASC`;

    const [
      sitiosRes,
      proyectosRes,
      materialesStockRes,
      todosProyectosRes,
      todosSitiosRes,
    ] = await Promise.all([
      pool.query(sitiosQuery),
      pool.query(proyectosQuery),
      pool.query(materialesStockQuery),
      pool.query(todosProyectosQuery),
      pool.query(todosSitiosQuery),
    ]);

    res.json({
      sitiosAsignados: sitiosRes.rows,
      proyectosAsignados: proyectosRes.rows,
      materialesEnStock: materialesStockRes.rows,
      todosProyectos: todosProyectosRes.rows,
      todosSitios: todosSitiosRes.rows,
    });
  } catch (error) {
    console.error("Error fetching filter data for RETIRO:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * GET /api/retiro/asignado/:sitioId/:proyectoId
 * ======================================================================================= */
const getMaterialesAsignados = async (req, res) => {
  const sitioId = toInt(req.params.sitioId);
  const proyectoId = toInt(req.params.proyectoId);

  if (!sitioId || !proyectoId) {
    return res.status(400).json({ error: "sitioId/proyectoId inválidos." });
  }

  try {
    const query = `
      SELECT
        ia.id AS asignacion_id,
        inv.material_id,
        cm.nombre AS material_nombre,
        cu.simbolo AS unidad_simbolo,
        ia.cantidad AS cantidad_asignada_pendiente,
        ia.valor_unitario,
        ia.moneda,
        ia.requisicion_id,
        ia.proyecto_id AS proyecto_origen_id,
        ia.sitio_id AS sitio_origen_id,
        inv.ubicacion_id
      FROM inventario_asignado ia
      JOIN inventario_actual inv ON ia.inventario_id = inv.id
      JOIN catalogo_materiales cm ON inv.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ia.sitio_id = $1
        AND ia.proyecto_id = $2
        AND ia.cantidad > 0
      ORDER BY cm.nombre ASC;
    `;

    const { rows } = await pool.query(query, [sitioId, proyectoId]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching assigned materials:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * GET /api/retiro/stock/:materialId
 * ======================================================================================= */
const getStockMaterial = async (req, res) => {
  const materialId = toInt(req.params.materialId);

  if (!materialId) {
    return res.status(400).json({ error: "materialId inválido." });
  }

  try {
    const query = `
      SELECT
        SUM(stock_actual) AS stock_total,
        jsonb_agg(
          jsonb_build_object(
            'ubicacion_id', ubicacion_id,
            'stock', stock_actual
          )
        ) FILTER (WHERE stock_actual > 0) AS ubicaciones_con_stock
      FROM inventario_actual
      WHERE material_id = $1
        AND stock_actual > 0;
    `;

    const { rows } = await pool.query(query, [materialId]);
    res.json(rows[0] || { stock_total: 0, ubicaciones_con_stock: [] });
  } catch (error) {
    console.error("Error fetching stock for material:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
};

/** =========================================================================================
 * POST /api/retiro/registrar
 * ======================================================================================= */
const registrarRetiro = async (req, res) => {
  const {
    tipoRetiro,
    solicitanteEmpleadoId,
    // STOCK: destino requerido
    proyectoDestinoId,
    sitioDestinoId,
    // ASIGNADO: origen informativo (para cabecera / validación de consistencia)
    proyectoOrigenId,
    sitioOrigenId,
    observaciones,
    items,
  } = req.body;

  const usuarioId = req.usuarioSira?.id;

  // --------------------------
  // Validaciones base
  // --------------------------
  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario no autenticado." });
  }

  if (!tipoRetiro || !["ASIGNADO", "STOCK"].includes(String(tipoRetiro).toUpperCase())) {
    return res.status(400).json({ error: "tipoRetiro inválido (ASIGNADO|STOCK)." });
  }

  const solicitanteId = toInt(solicitanteEmpleadoId);
  if (!solicitanteId) {
    return res.status(400).json({ error: "solicitanteEmpleadoId es obligatorio y debe ser numérico." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items es obligatorio y debe contener al menos 1 elemento." });
  }

  const tipo = String(tipoRetiro).toUpperCase();

  if (tipo === "STOCK") {
    if (!toInt(sitioDestinoId) || !toInt(proyectoDestinoId)) {
      return res.status(400).json({ error: "Para STOCK, sitioDestinoId y proyectoDestinoId son obligatorios." });
    }
  }

  if (tipo === "ASIGNADO") {
    // destino eliminado (opción 1): no se exige destino.
    // origen es recomendado para cabecera y consistencia, pero no bloqueamos si no viene
    // (porque el origen real sale de cada asignación).
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validar solicitante existe (y opcionalmente que esté activo)
    const empRes = await client.query(
      `SELECT id, status_laboral FROM public.empleados WHERE id = $1 LIMIT 1`,
      [solicitanteId]
    );
    if (empRes.rowCount === 0) throw new Error("El solicitante (empleado) no existe.");
    // Si quieres forzar solo activos:
    if (String(empRes.rows[0].status_laboral).toLowerCase() !== "activo") {
      throw new Error("El solicitante debe estar en status_laboral='activo'.");
    }

    // Crear cabecera (salidas_almacen)
    const salidaIns = await client.query(
      `
      INSERT INTO public.salidas_almacen
        (tipo_retiro, usuario_id, solicitante_empleado_id,
         sitio_origen_id, proyecto_origen_id,
         sitio_destino_id, proyecto_destino_id,
         observaciones)
      VALUES
        ($1, $2, $3,
         $4, $5,
         $6, $7,
         $8)
      RETURNING id, fecha
      `,
      [
        tipo,
        usuarioId,
        solicitanteId,
        toInt(sitioOrigenId),
        toInt(proyectoOrigenId),
        toInt(sitioDestinoId),
        toInt(proyectoDestinoId),
        (observaciones || "").toString().trim() || null,
      ]
    );

    const salidaAlmacenId = salidaIns.rows[0].id;

    const movimientosRegistrados = [];

    // =====================================================================
    // ASIGNADO
    // =====================================================================
    if (tipo === "ASIGNADO") {
      for (const item of items) {
        const asignacionId = toInt(item.asignacion_id);
        const materialId = toInt(item.material_id);
        const cantidadNum = toNumber(item.cantidad_a_retirar, 0);

        if (!asignacionId || !materialId || cantidadNum <= 0) continue;

        // Lock de la asignación y su inventario físico
        const asigRes = await client.query(
          `
          SELECT
            ia.id,
            ia.inventario_id,
            ia.requisicion_id,
            ia.proyecto_id AS proyecto_origen_id,
            ia.sitio_id AS sitio_origen_id,
            ia.cantidad,
            inv.material_id,
            inv.ubicacion_id,
            inv.ultimo_precio_entrada,
            inv.moneda
          FROM public.inventario_asignado ia
          JOIN public.inventario_actual inv ON inv.id = ia.inventario_id
          WHERE ia.id = $1
          FOR UPDATE
          `,
          [asignacionId]
        );

        if (asigRes.rowCount === 0) {
          throw new Error(`Asignación ${asignacionId} no encontrada.`);
        }

        const asig = asigRes.rows[0];

        // Consistencia: material debe coincidir con la asignación
        if (Number(asig.material_id) !== Number(materialId)) {
          throw new Error(
            `Asignación ${asignacionId}: material_id no coincide (payload=${materialId}, DB=${asig.material_id}).`
          );
        }

        // Consistencia opcional con origen seleccionado en UI
        if (toInt(proyectoOrigenId) && Number(asig.proyecto_origen_id) !== Number(toInt(proyectoOrigenId))) {
          throw new Error(`Asignación ${asignacionId}: proyecto origen no coincide con selección UI.`);
        }
        if (toInt(sitioOrigenId) && Number(asig.sitio_origen_id) !== Number(toInt(sitioOrigenId))) {
          throw new Error(`Asignación ${asignacionId}: sitio origen no coincide con selección UI.`);
        }

        if (toNumber(asig.cantidad, 0) < cantidadNum) {
          throw new Error(`Stock asignado insuficiente para Asignación ${asignacionId}.`);
        }

        // 1) reducir inventario_asignado
        await client.query(
          `
          UPDATE public.inventario_asignado
             SET cantidad = cantidad - $1,
                 asignado_en = NOW()
           WHERE id = $2
          `,
          [cantidadNum, asignacionId]
        );

        // 2) reducir inventario_actual.asignado (misma ubicación física)
        const invUpd = await client.query(
          `
          UPDATE public.inventario_actual
             SET asignado = asignado - $1,
                 actualizado_en = NOW()
           WHERE id = $2
             AND asignado >= $1
          `,
          [cantidadNum, asig.inventario_id]
        );
        if (invUpd.rowCount === 0) {
          throw new Error(
            `Error al descontar inventario_actual.asignado (inventario_id=${asig.inventario_id}).`
          );
        }

        // 3) registrar item (detalle)
        await client.query(
          `
          INSERT INTO public.salidas_almacen_items
            (salida_almacen_id, material_id, ubicacion_id, cantidad, asignacion_origen_id)
          VALUES
            ($1, $2, $3, $4, $5)
          `,
          [salidaAlmacenId, materialId, asig.ubicacion_id, cantidadNum, asignacionId]
        );

        // 4) kardex SALIDA
        const valorUnitario = toNumber(asig.ultimo_precio_entrada, 0);
        const moneda = asig.moneda || null;
        const obs = `Retiro ASIGNADO (AsigID:${asignacionId}) - consumo en proyecto_origen=${asig.proyecto_origen_id}`;

        const movIns = await client.query(
          `
          INSERT INTO public.movimientos_inventario
            (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
             proyecto_origen_id, proyecto_destino_id,
             orden_compra_id, requisicion_id,
             valor_unitario, moneda, observaciones,
             asignacion_origen_id, salida_almacen_id)
          VALUES
            ($1, 'SALIDA', $2, $3, $4,
             $5, NULL,
             NULL, NULL,
             $6, $7, $8,
             $9, $10)
          RETURNING id
          `,
          [
            materialId,
            cantidadNum,
            usuarioId,
            asig.ubicacion_id,
            asig.proyecto_origen_id,
            valorUnitario,
            moneda,
            obs,
            asignacionId,
            salidaAlmacenId,
          ]
        );

        movimientosRegistrados.push({
          movimiento_id: movIns.rows[0].id,
          material_id: materialId,
          ubicacion_id: asig.ubicacion_id,
          cantidad: cantidadNum,
          tipo: "SALIDA_ASIGNADO",
        });
      }
    }

    // =====================================================================
    // STOCK
    // =====================================================================
    if (tipo === "STOCK") {
      const sitioDest = toInt(sitioDestinoId);
      const proyectoDest = toInt(proyectoDestinoId);

      for (const item of items) {
        const materialId = toInt(item.material_id);
        let cantidadRestante = toNumber(item.cantidad_a_retirar, 0);

        if (!materialId || cantidadRestante <= 0) continue;

        // Lock filas de inventario_actual con stock para ese material
        const ubiRes = await client.query(
          `
          SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
          FROM public.inventario_actual
          WHERE material_id = $1
            AND stock_actual > 0
          ORDER BY stock_actual DESC, id ASC
          FOR UPDATE
          `,
          [materialId]
        );

        const totalDisponible = (ubiRes.rows || []).reduce((sum, u) => sum + toNumber(u.stock_actual, 0), 0);
        if (ubiRes.rowCount === 0 || totalDisponible < cantidadRestante) {
          throw new Error(`Stock insuficiente para material ${materialId}. Disponible=${totalDisponible}, requerido=${cantidadRestante}`);
        }

        // Consumir de varias ubicaciones si aplica
        for (const ubi of ubiRes.rows) {
          if (cantidadRestante <= 0) break;

          const stockEnUbicacion = toNumber(ubi.stock_actual, 0);
          const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);

          if (cantidadARestar <= 0) continue;

          await client.query(
            `
            UPDATE public.inventario_actual
               SET stock_actual = stock_actual - $1,
                   actualizado_en = NOW()
             WHERE id = $2
            `,
            [cantidadARestar, ubi.id]
          );

          // detalle
          await client.query(
            `
            INSERT INTO public.salidas_almacen_items
              (salida_almacen_id, material_id, ubicacion_id, cantidad, asignacion_origen_id)
            VALUES
              ($1, $2, $3, $4, NULL)
            `,
            [salidaAlmacenId, materialId, ubi.ubicacion_id, cantidadARestar]
          );

          // kardex
          const valorUnitario = toNumber(ubi.ultimo_precio_entrada, 0);
          const moneda = ubi.moneda || null;
          const obs = `Retiro STOCK -> destino sitio=${sitioDest} proyecto=${proyectoDest}`;

          const movIns = await client.query(
            `
            INSERT INTO public.movimientos_inventario
              (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
               proyecto_origen_id, proyecto_destino_id,
               orden_compra_id, requisicion_id,
               valor_unitario, moneda, observaciones,
               asignacion_origen_id, salida_almacen_id)
            VALUES
              ($1, 'SALIDA', $2, $3, $4,
               NULL, $5,
               NULL, NULL,
               $6, $7, $8,
               NULL, $9)
            RETURNING id
            `,
            [
              materialId,
              cantidadARestar,
              usuarioId,
              ubi.ubicacion_id,
              proyectoDest,
              valorUnitario,
              moneda,
              obs,
              salidaAlmacenId,
            ]
          );

          movimientosRegistrados.push({
            movimiento_id: movIns.rows[0].id,
            material_id: materialId,
            ubicacion_id: ubi.ubicacion_id,
            cantidad: cantidadARestar,
            tipo: "SALIDA_STOCK",
          });

          cantidadRestante -= cantidadARestar;
        }
      }
    }

    if (movimientosRegistrados.length === 0) {
      throw new Error("No se registró ningún movimiento. Revisa items/cantidades.");
    }

    await client.query("COMMIT");
    return res.json({
      mensaje: "Retiro registrado con éxito.",
      salida_almacen_id: salidaAlmacenId,
      movimientos: movimientosRegistrados,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando retiro:", error);
    return res.status(400).json({ error: error.message || "Error al registrar el retiro." });
  } finally {
    client.release();
  }
};

module.exports = {
  getDatosFiltrosRetiro,
  getMaterialesAsignados,
  getStockMaterial,
  registrarRetiro,
};
