/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    // Este comando "toca" cada fila de la tabla 'unidades' sin cambiar datos.
  // Esto es suficiente para disparar el trigger 'tg_sync_unidad_insert_update'
  // que creamos en la migración anterior, creando los "proyectos espejo"
  // para todas las unidades que ya existen en la base de datos.
  pgm.sql(`
    UPDATE public.unidades
    SET activo = activo;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Esta acción no tiene 'down', ya que solo está
  // disparando un trigger para poblar datos.
  return null;
};
