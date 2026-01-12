// backend/controllers/inventario/inventarioAsignado.service.js
/**
 * INVENTARIO ASIGNADO (SERVICIO)
 * =============================================================================
 * - decrementInventarioAsignado: descuenta cantidad repartiendo entre filas existentes
 * - upsertInventarioAsignado: incrementa si existe, si no inserta
 *
 * Nota: requisicion_id se maneja con "IS NOT DISTINCT FROM" para soportar NULL.
 */

const { toNumber } = require("./helpers");

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

  const total = (rowsRes.rows || []).reduce(
    (acc, r) => acc + toNumber(r.cantidad, 0),
    0
  );

  if (total < restante) {
    throw new Error(
      `No hay suficiente inventario_asignado. Requerido=${restante}, Disponible=${total}`
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

module.exports = {
  decrementInventarioAsignado,
  upsertInventarioAsignado,
};
