// backend/controllers/retiro.controller.js
const pool = require("../db/pool");

/**
 * RETIRO (Salida física)
 * =========================================================================================
 * Este módulo registra salidas reales de material.
 *
 * Dos tipos:
 * 1) ASIGNADO:
 *    - Sale de inventario_asignado (apartado por proyecto/sitio)
 *    - Se descuenta inventario_actual.asignado (misma ubicación física del inventario_id)
 *    - Kardex: movimientos_inventario tipo_movimiento = 'SALIDA'
 *      * proyecto_origen_id = proyecto del apartado
 *      * proyecto_destino_id = destino (seleccionado por UI)
 *      * requisicion_id = requisición que originó el apartado (para reversa correcta)
 *
 * 2) STOCK:
 *    - Sale de inventario_actual.stock_actual (de todas las ubicaciones disponibles)
 *    - Kardex: movimientos_inventario tipo_movimiento = 'SALIDA'
 *      * proyecto_origen_id = NULL (porque venía de stock general)
 *      * proyecto_destino_id = destino seleccionado
 *
 * IMPORTANTE PARA REVERSAS:
 * - Si una salida salió de ASIGNADO, DEBE llevar requisicion_id y proyecto_origen_id,
 *   para que la reversa pueda devolver correctamente a asignado (no a stock).
 * - Si una salida salió de STOCK, requisicion_id debe ser NULL y proyecto_origen_id NULL.
 *
 * VALUACIÓN:
 * - Regla del proyecto: siempre usar el último precio de entrada (inventario_actual.ultimo_precio_entrada)
 *   para registrar valor_unitario en kardex.
 */

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
  const { sitioId, proyectoId } = req.params;

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
  const { materialId } = req.params;

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
  const { tipoRetiro, items, proyectoDestinoId, sitioDestinoId } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (
    !tipoRetiro ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !proyectoDestinoId ||
    !sitioDestinoId
  ) {
    return res.status(400).json({ error: "Datos de retiro inválidos." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const movimientosRegistrados = [];

    if (tipoRetiro === "ASIGNADO") {
      for (const item of items) {
        const asignacionId = item.asignacion_id;
        const materialId = item.material_id;
        const cantidadNum = parseFloat(item.cantidad_a_retirar) || 0;

        if (!asignacionId || !materialId || cantidadNum <= 0) continue;

        /**
         * 1) Tomamos la asignación FOR UPDATE para:
         * - validar disponibilidad
         * - obtener requisicion_id, proyecto_origen_id
         * - obtener inventario_id -> ubicacion_id física
         * - VALUACIÓN: usamos inv.ultimo_precio_entrada y inv.moneda
         */
        const asigRes = await client.query(
          `
          SELECT
            ia.id,
            ia.inventario_id,
            ia.requisicion_id,
            ia.proyecto_id AS proyecto_origen_id,
            ia.sitio_id AS sitio_origen_id,
            ia.cantidad,
            ia.valor_unitario AS valor_unitario_asignacion,
            ia.moneda AS moneda_asignacion,
            inv.material_id,
            inv.ubicacion_id,
            inv.ultimo_precio_entrada,
            inv.moneda
          FROM inventario_asignado ia
          JOIN inventario_actual inv ON ia.inventario_id = inv.id
          WHERE ia.id = $1
          FOR UPDATE
          `,
          [asignacionId]
        );

        if (asigRes.rowCount === 0) {
          throw new Error(`Asignación ${asignacionId} no encontrada.`);
        }

        const asig = asigRes.rows[0];

        if (parseFloat(asig.cantidad) < cantidadNum) {
          throw new Error(`Stock asignado insuficiente para Asignación ${asignacionId}.`);
        }

        // 2) Reducir inventario_asignado
        await client.query(
          `
          UPDATE inventario_asignado
          SET cantidad = cantidad - $1
          WHERE id = $2
          `,
          [cantidadNum, asignacionId]
        );

        // 3) Reducir inventario_actual.asignado (misma ubicación física)
        const invUpd = await client.query(
          `
          UPDATE inventario_actual
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

        // 4) Kardex SALIDA (desde ASIGNADO)
        // Regla valuación: último precio de entrada
        const valorUnitario =
          parseFloat(asig.ultimo_precio_entrada) ||
          parseFloat(asig.valor_unitario_asignacion) ||
          0;

        const moneda =
          asig.moneda ||
          asig.moneda_asignacion ||
          null;

        const obs = `Retiro ASIGNADO (AsigID:${asignacionId}) -> destino sitio=${sitioDestinoId} proyecto=${proyectoDestinoId}`;

        const movIns = await client.query(
          `
          INSERT INTO movimientos_inventario
            (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
             proyecto_origen_id, proyecto_destino_id, orden_compra_id, requisicion_id,
             valor_unitario, moneda, observaciones)
          VALUES
            ($1, 'SALIDA', $2, $3, $4,
             $5, $6, NULL, $7,
             $8, $9, $10)
          RETURNING id
          `,
          [
            materialId,
            cantidadNum,
            usuarioId,
            asig.ubicacion_id,
            asig.proyecto_origen_id,     // ✅ clave para reversa a ASIGNADO
            proyectoDestinoId,
            asig.requisicion_id || null, // ✅ clave para reversa a ASIGNADO
            valorUnitario,
            moneda,
            obs,
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
    } else if (tipoRetiro === "STOCK") {
      for (const item of items) {
        const materialId = item.material_id;
        let cantidadRestante = parseFloat(item.cantidad_a_retirar) || 0;

        if (!materialId || cantidadRestante <= 0) continue;

        const ubicacionesStock = await client.query(
          `
          SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
          FROM inventario_actual
          WHERE material_id = $1
            AND stock_actual > 0
          ORDER BY stock_actual DESC
          FOR UPDATE
          `,
          [materialId]
        );

        const totalDisponible = ubicacionesStock.rows.reduce(
          (sum, u) => sum + parseFloat(u.stock_actual),
          0
        );

        if (ubicacionesStock.rows.length === 0 || totalDisponible < cantidadRestante) {
          throw new Error(`Stock insuficiente para material ${materialId}.`);
        }

        for (const ubi of ubicacionesStock.rows) {
          const stockEnUbicacion = parseFloat(ubi.stock_actual);
          const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);

          if (cantidadARestar <= 0) continue;

          await client.query(
            `
            UPDATE inventario_actual
            SET stock_actual = stock_actual - $1,
                actualizado_en = NOW()
            WHERE id = $2
            `,
            [cantidadARestar, ubi.id]
          );

          const valorUnitario = parseFloat(ubi.ultimo_precio_entrada) || 0;
          const moneda = ubi.moneda || null;

          const obs = `Retiro STOCK -> destino sitio=${sitioDestinoId} proyecto=${proyectoDestinoId}`;

          const movIns = await client.query(
            `
            INSERT INTO movimientos_inventario
              (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
               proyecto_origen_id, proyecto_destino_id, orden_compra_id, requisicion_id,
               valor_unitario, moneda, observaciones)
            VALUES
              ($1, 'SALIDA', $2, $3, $4,
               NULL, $5, NULL, NULL,
               $6, $7, $8)
            RETURNING id
            `,
            [
              materialId,
              cantidadARestar,
              usuarioId,
              ubi.ubicacion_id,
              proyectoDestinoId,
              valorUnitario,
              moneda,
              obs,
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
          if (cantidadRestante <= 0) break;
        }
      }
    } else {
      throw new Error("Tipo de retiro no válido.");
    }

    await client.query("COMMIT");
    res.status(200).json({
      mensaje: "Retiro registrado exitosamente.",
      movimientos: movimientosRegistrados,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando retiro:", error);
    res.status(500).json({ error: error.message || "Error interno al registrar el retiro." });
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
