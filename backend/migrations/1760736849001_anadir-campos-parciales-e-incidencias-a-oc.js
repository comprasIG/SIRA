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

// Use ifNotExists for columns and indexes
  pgm.addColumn('ordenes_compra_detalle', {
    cantidad_recibida: {
      type: 'numeric(12, 2)',
      notNull: true,
      default: 0,
      comment: 'Cantidad de este ítem que ya ha sido físicamente recibida.',
    },
  }, { ifNotExists: true }); // Column idempotency

  pgm.addColumn('ordenes_compra', {
    entrega_parcial: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'TRUE si se ha registrado al menos una recepción parcial y la OC aún no está completa.',
    },
  }, { ifNotExists: true });

  pgm.addColumn('ordenes_compra', {
     con_incidencia: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'TRUE si se ha reportado al menos una incidencia durante la recepción.',
    },
  }, { ifNotExists: true });


  pgm.createIndex('ordenes_compra', 'entrega_parcial', { ifNotExists: true }); // Index idempotency
  pgm.createIndex('ordenes_compra', 'con_incidencia', { ifNotExists: true });

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

// Use ifExists for dropping indexes and columns
  pgm.dropIndex('ordenes_compra', 'entrega_parcial', { ifExists: true });
  pgm.dropIndex('ordenes_compra', 'con_incidencia', { ifExists: true });
  // Drop columns individually with ifExists check
  pgm.dropColumn('ordenes_compra', 'entrega_parcial', { ifExists: true });
  pgm.dropColumn('ordenes_compra', 'con_incidencia', { ifExists: true });
  pgm.dropColumn('ordenes_compra_detalle', 'cantidad_recibida', { ifExists: true });

};
