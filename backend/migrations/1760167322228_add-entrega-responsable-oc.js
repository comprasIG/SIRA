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
 pgm.addColumn('ordenes_compra', {
    entrega_responsable: {
      type: 'varchar(30)',
      notNull: false,
      comment: 'Quién entrega: EQUIPO_RECOLECCION | PROVEEDOR'
    }
  });

  // Opcional: índice si vas a filtrar por esto
  // pgm.createIndex('ordenes_compra', 'entrega_responsable');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     // pgm.dropIndex('ordenes_compra', 'entrega_responsable');
  pgm.dropColumn('ordenes_compra', 'entrega_responsable');
  
};
