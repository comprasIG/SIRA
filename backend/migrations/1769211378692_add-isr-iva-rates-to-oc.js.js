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
    pgm.sql(`
    ALTER TABLE public.ordenes_compra
      ADD COLUMN IF NOT EXISTS ret_isr  numeric(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS iva_rate numeric(8,4)  NOT NULL DEFAULT 0.16,
      ADD COLUMN IF NOT EXISTS isr_rate numeric(8,4)  NOT NULL DEFAULT 0;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
     pgm.sql(`
    ALTER TABLE public.ordenes_compra
      DROP COLUMN IF EXISTS ret_isr,
      DROP COLUMN IF EXISTS iva_rate,
      DROP COLUMN IF EXISTS isr_rate;
  `);
};
