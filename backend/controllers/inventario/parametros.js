// backend/controllers/inventario/parametros.js
/**
 * PARAMETROS DEL SISTEMA
 * =============================================================================
 * Lectura de parámetros desde public.parametros_sistema
 */

const getParametroSistema = async (client, clave) => {
  const { rows } = await client.query(
    `SELECT valor FROM public.parametros_sistema WHERE clave = $1 LIMIT 1`,
    [clave]
  );
  return rows[0]?.valor ?? null;
};

module.exports = {
  getParametroSistema,
};
