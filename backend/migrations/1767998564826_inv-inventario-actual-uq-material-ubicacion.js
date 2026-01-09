/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
 /**
   * Esta migración arregla el error:
   *   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
   *
   * Porque registrarIngreso hace:
   *   ON CONFLICT (material_id, ubicacion_id)
   *
   * Para que eso funcione, Postgres necesita un UNIQUE INDEX o UNIQUE CONSTRAINT
   * sobre esas columnas.
   *
   * Importante:
   * - Esto es idempotente (IF NOT EXISTS).
   * - Un UNIQUE INDEX es suficiente para que ON CONFLICT (cols) funcione.
   */
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_material_ubicacion
    ON public.inventario_actual (material_id, ubicacion_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Rollback seguro / idempotente
  pgm.sql(`
    DROP INDEX IF EXISTS public.uq_inv_material_ubicacion;
  `);
};
