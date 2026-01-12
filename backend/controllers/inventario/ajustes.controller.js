// backend/controllers/inventario/ajustes.controller.js
/**
 * POST /api/inventario/ajustes
 * =============================================================================
 * - Solo superusuario
 * - Permite crear inventario_actual si no existe (alta inicial)
 * - Precio/moneda solo si (stock + asignado) == 0 y delta > 0
 */

const pool = require("../../db/pool");
const { toNumber, toTrimmedString } = require("./helpers");
const { ensureInventarioActualExists, getTotalExistencia } = require("./inventarioActual.service");

const ajustarInventario = async (req, res) => {
  const { id: usuarioId, es_superusuario } = req.usuarioSira;

  if (!es_superusuario) {
    return res
      .status(403)
      .json({ error: "No autorizado. Solo superusuario puede realizar ajustes." });
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
      if (!Number.isFinite(deltaNum) || deltaNum === 0)
        throw new Error("delta debe ser un número distinto de 0.");
      if (!observaciones) throw new Error("observaciones es requerido (texto).");

      // Validar / resolver ubicacion_id (si no viene, usar primera ubicación)
      if (!ubicacion_id) {
        const def = await client.query(
          `SELECT id FROM public.ubicaciones_almacen ORDER BY id ASC LIMIT 1`
        );
        if (def.rowCount === 0) {
          throw new Error(
            "No existe ninguna ubicación en ubicaciones_almacen. Debes crear una o enviar ubicacion_id."
          );
        }
        ubicacion_id = def.rows[0].id;
      } else {
        const exists = await client.query(
          `SELECT 1 FROM public.ubicaciones_almacen WHERE id = $1`,
          [ubicacion_id]
        );
        if (exists.rowCount === 0) {
          throw new Error("ubicacion_id inválida: debe existir en ubicaciones_almacen.");
        }
      }

      const inv = await ensureInventarioActualExists(client, material_id, ubicacion_id);

      const stockActual = toNumber(inv.stock_actual, 0);
      const totalAntes = getTotalExistencia(inv);

      // No permitir stock disponible negativo
      const stockNuevo = stockActual + deltaNum;
      if (stockNuevo < 0) {
        throw new Error(
          `Stock insuficiente para ajuste negativo. Disponible: ${stockActual}, delta: ${deltaNum}`
        );
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
        [
          material_id,
          tipo_movimiento,
          cantidadMovimiento,
          usuarioId,
          ubicacion_id,
          precioFinal,
          monedaFinal,
          observaciones,
        ]
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

module.exports = { ajustarInventario };
