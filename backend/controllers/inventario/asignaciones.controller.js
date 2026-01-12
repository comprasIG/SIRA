// backend/controllers/inventario/asignaciones.controller.js
/**
 * ASIGNACIONES
 * =============================================================================
 * POST /api/inventario/apartar
 * POST /api/inventario/mover-asignacion
 */

const pool = require("../../db/pool");
const { toNumber, toInt } = require("./helpers");
const { upsertInventarioAsignado } = require("./inventarioAsignado.service");

/**
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
 */
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

      // 3) Kardex: APARTADO
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
          `APARTADO a proyecto=${proyecto_id} sitio=${sitio_id}${
            requisicionId ? ` req=${requisicionId}` : ""
          }`,
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

/**
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
 */
const moverAsignacion = async (req, res) => {
  const { asignacion_id, nuevo_sitio_id, nuevo_proyecto_id, cantidad } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!asignacion_id || !nuevo_sitio_id || !nuevo_proyecto_id) {
    return res.status(400).json({ error: "Faltan datos para mover la asignación." });
  }

  const moverQty =
    cantidad !== undefined && cantidad !== null && `${cantidad}` !== ""
      ? toNumber(cantidad, NaN)
      : null;

  if (moverQty !== null && (!Number.isFinite(moverQty) || moverQty <= 0)) {
    return res.status(400).json({ error: "cantidad debe ser un número > 0 (si se envía)." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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
      throw new Error(
        `No puedes mover más de lo asignado. Asignado=${qtyOrigen}, solicitado=${qtyMover}`
      );
    }

    // Idempotencia: si el destino es igual al origen
    if (
      String(origenProyecto) === String(destinoProyecto) &&
      String(origenSitio) === String(destinoSitio)
    ) {
      await client.query("ROLLBACK");
      return res.status(200).json({ mensaje: "La asignación ya está en ese destino (sin cambios)." });
    }

    // Origen: parcial o total (mantenemos fila en 0 para historial)
    if (qtyMover < qtyOrigen) {
      await client.query(
        `UPDATE public.inventario_asignado SET cantidad = cantidad - $1 WHERE id = $2`,
        [qtyMover, asignacion_id]
      );
    } else {
      await client.query(`UPDATE public.inventario_asignado SET cantidad = 0 WHERE id = $1`, [
        asignacion_id,
      ]);
    }

    // Destino: upsert
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

module.exports = {
  apartarStock,
  moverAsignacion,
};
