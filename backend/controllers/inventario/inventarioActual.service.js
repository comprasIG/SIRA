// backend/controllers/inventario/inventarioActual.service.js
/**
 * INVENTARIO ACTUAL (SERVICIO)
 * =============================================================================
 * Operaciones con inventario_actual con consistencia por transacción:
 * - SELECT ... FOR UPDATE
 * - Ensure create (alta inicial en ceros)
 */

const { toNumber } = require("./helpers");

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
 * Retorna stock_actual+asignado (numérico seguro)
 */
const getTotalExistencia = (invRow) => {
  const stock = toNumber(invRow?.stock_actual, 0);
  const asig = toNumber(invRow?.asignado, 0);
  return stock + asig;
};

module.exports = {
  getInventarioActualForUpdate,
  ensureInventarioActualExists,
  getTotalExistencia,
};
