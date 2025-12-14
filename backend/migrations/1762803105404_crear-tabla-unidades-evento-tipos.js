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
    pgm.createTable('unidades_evento_tipos', {
    id: 'id',
    codigo: { type: 'varchar(50)', notNull: true, unique: true },
    nombre: { type: 'varchar(100)', notNull: true },
    descripcion: { type: 'text' },
    activo: { type: 'boolean', default: true, notNull: true },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    actualizado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('unidades_evento_tipos');
};
