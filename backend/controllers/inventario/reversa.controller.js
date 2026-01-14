// backend/controllers/inventario/reversa.controller.js
/**
 * POST /api/inventario/movimientos/:id/reversar
 * =============================================================================
 * Reglas:
 * - Solo superusuario
 * - Solo mismo día (CDMX)
 * - Bloquear si la reversa generaría negativos
 * - Marca movimiento original como ANULADO
 * - Inserta un movimiento de auditoría ligado con reversa_de_movimiento_id
 *
 * NOTA IMPORTANTE:
 * - Para SALIDA desde ASIGNADO:
 *   - NO se usa requisicion_id (por regla de negocio).
 *   - Se prioriza mov.asignacion_origen_id para devolver EXACTAMENTE al origen.
 */

const pool = require("../../db/pool");
const { toNumber, toInt, toTrimmedString, isSuperuser } = require("./helpers");
const { getParametroSistema } = require("./parametros");
const { ensureInventarioActualExists } = require("./inventarioActual.service");
const {
  decrementInventarioAsignado,
  upsertInventarioAsignado,
} = require("./inventarioAsignado.service");

/**
 * Regla: solo reversa mismo día (fecha local CDMX).
 */
const isSameLocalDayMexicoCity = async (client, movimientoId) => {
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

    if (movRes.rowCount === 0) throw new Error("Movimiento no encontrado.");

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

    if (cantidad <= 0) throw new Error("Cantidad inválida en el movimiento (debe ser > 0).");

    // Lock inventario_actual (misma ubicación física del movimiento)
    const inv = await ensureInventarioActualExists(client, materialId, ubicacionId);

    /**
     * Inserta movimiento de auditoría ligado.
     * - Importante: cantidad siempre positiva.
     * - Conserva valor_unitario/moneda del movimiento original por trazabilidad.
     */
    const insertReversaAudit = async ({
      tipo_movimiento,
      proyecto_origen_id,
      proyecto_destino_id,
      observacionesExtra,
      asignacion_origen_id = null,
    }) => {
      await client.query(
        `
        INSERT INTO public.movimientos_inventario
          (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
           proyecto_origen_id, proyecto_destino_id, orden_compra_id, requisicion_id,
           valor_unitario, moneda, observaciones, reversa_de_movimiento_id,
           asignacion_origen_id, salida_almacen_id)
        VALUES
          ($1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15)
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
          `REVERSA de movimiento #${movimientoId}. Motivo: ${motivoTxt}. ${
            observacionesExtra || ""
          }`.trim(),
          movimientoId,
          asignacion_origen_id,
          mov.salida_almacen_id ?? null,
        ]
      );
    };

    const tipo = mov.tipo_movimiento;

    const stockActual = toNumber(inv.stock_actual, 0);
    const asignadoActual = toNumber(inv.asignado, 0);

    // -------------------------------------------------------------------------
    // AJUSTES
    // -------------------------------------------------------------------------
    if (tipo === "AJUSTE_POSITIVO") {
      if (stockActual < cantidad) {
        throw new Error(
          `Reversa inválida: dejaría stock negativo. Stock=${stockActual}, requerido=${cantidad}`
        );
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
    }

    // -------------------------------------------------------------------------
    // APARTADO (stock -> asignado)
    // -------------------------------------------------------------------------
    else if (tipo === "APARTADO") {
      if (asignadoActual < cantidad) {
        throw new Error(
          `Reversa inválida: no hay asignado suficiente. Asignado=${asignadoActual}, requerido=${cantidad}`
        );
      }

      const proyectoDestino = mov.proyecto_destino_id;
      if (!proyectoDestino) {
        throw new Error("Movimiento APARTADO sin proyecto_destino_id. No se puede reversar.");
      }

      await decrementInventarioAsignado({
        client,
        inventarioId: inv.id,
        proyectoId: proyectoDestino,
        sitioId: null, // no se guarda sitio en movimientos; se descuenta por proyecto
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
        proyecto_destino_id: null,
        observacionesExtra: "Reversa de APARTADO: regresa de asignado a disponible.",
      });
    }

    // -------------------------------------------------------------------------
    // TRASPASO (asignado entre proyectos)
    // -------------------------------------------------------------------------
    else if (tipo === "TRASPASO") {
      const po = mov.proyecto_origen_id;
      const pd = mov.proyecto_destino_id;

      if (!po || !pd) {
        throw new Error("TRASPASO sin proyecto_origen/destino. No se puede reversar.");
      }

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

      const totalDest = (destRows.rows || []).reduce(
        (acc, r) => acc + toNumber(r.cantidad, 0),
        0
      );
      if (totalDest < restante) {
        throw new Error(
          `Reversa inválida: no hay suficiente en destino para deshacer TRASPASO. Disponible=${totalDest}, requerido=${restante}`
        );
      }

      for (const r of destRows.rows) {
        if (restante <= 0) break;

        const disp = toNumber(r.cantidad, 0);
        const mover = Math.min(restante, disp);

        await client.query(`UPDATE public.inventario_asignado SET cantidad = cantidad - $1 WHERE id = $2`, [
          mover,
          r.id,
        ]);

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
    }

    // -------------------------------------------------------------------------
    // ENTRADA (depende de OC y parámetro sitio almacén central)
    // -------------------------------------------------------------------------
    else if (tipo === "ENTRADA") {
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
        if (stockActual < cantidad) {
          throw new Error(
            `Reversa inválida: dejaría stock negativo. Stock=${stockActual}, requerido=${cantidad}`
          );
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
        const proyectoDestino = mov.proyecto_destino_id;
        if (!proyectoDestino) {
          throw new Error("ENTRADA asignada sin proyecto_destino_id. No se puede reversar.");
        }

        if (!ocSitioId) {
          const pRes = await client.query(
            `SELECT sitio_id FROM public.proyectos WHERE id = $1 LIMIT 1`,
            [proyectoDestino]
          );
          ocSitioId = pRes.rows[0]?.sitio_id ?? null;
        }
        if (!ocSitioId) throw new Error("No se pudo resolver sitio destino para reversa de ENTRADA asignada.");

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
    }

    // -------------------------------------------------------------------------
    // SALIDA (stock o asignado)
    // -------------------------------------------------------------------------
    else if (tipo === "SALIDA") {
      const proyectoOrigen = mov.proyecto_origen_id;   // null => salió de stock
      const proyectoDestino = mov.proyecto_destino_id; // auditoría

      // Caso A: SALIDA desde STOCK
      if (!proyectoOrigen) {
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
        // Caso B: SALIDA desde ASIGNADO
        // Regresa al ASIGNADO de inventario_actual y a inventario_asignado.
        // Sitio origen: por proyecto (requisición no aplica para salidas).
        const pRes = await client.query(
          `SELECT sitio_id FROM public.proyectos WHERE id = $1 LIMIT 1`,
          [proyectoOrigen]
        );
        const sitioOrigen = pRes.rows[0]?.sitio_id ?? null;
        if (!sitioOrigen) throw new Error("No se pudo resolver sitio (proyecto_origen_id) para reversa de SALIDA.");

        await client.query(
          `
          UPDATE public.inventario_actual
             SET asignado = asignado + $1,
                 actualizado_en = NOW()
           WHERE id = $2
          `,
          [cantidad, inv.id]
        );

        // ✅ Prioridad: asignacion_origen_id
        const asignacionOrigenId = mov.asignacion_origen_id ?? null;

        if (asignacionOrigenId) {
          const asigLock = await client.query(
            `
            SELECT id
            FROM public.inventario_asignado
            WHERE id = $1
            FOR UPDATE
            `,
            [asignacionOrigenId]
          );

          if (asigLock.rowCount > 0) {
            await client.query(
              `
              UPDATE public.inventario_asignado
                 SET cantidad = cantidad + $1,
                     asignado_en = NOW()
               WHERE id = $2
              `,
              [cantidad, asignacionOrigenId]
            );
          } else {
            // Fallback: crear/actualizar pool por proyecto/sitio (requisicion NULL)
            await upsertInventarioAsignado({
              client,
              inventarioId: inv.id,
              proyectoId: proyectoOrigen,
              sitioId: sitioOrigen,
              requisicionId: null,
              cantidad,
              valorUnitario: mov.valor_unitario ?? 0,
              moneda: mov.moneda ?? null,
            });
          }
        } else {
          // Movimientos antiguos sin asignacion_origen_id
          await upsertInventarioAsignado({
            client,
            inventarioId: inv.id,
            proyectoId: proyectoOrigen,
            sitioId: sitioOrigen,
            requisicionId: null,
            cantidad,
            valorUnitario: mov.valor_unitario ?? 0,
            moneda: mov.moneda ?? null,
          });
        }

        await insertReversaAudit({
          tipo_movimiento: "SALIDA",
          proyecto_origen_id: proyectoOrigen,
          proyecto_destino_id: proyectoDestino ?? null,
          observacionesExtra: `Reversa de SALIDA desde ASIGNADO: regresa a asignado (sitio=${sitioOrigen}).`,
          asignacion_origen_id: asignacionOrigenId,
        });
      }
    } else {
      throw new Error(`Tipo de movimiento no soportado para reversa: ${tipo}`);
    }

    // Marcar movimiento original como ANULADO
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

module.exports = { reversarMovimiento };
