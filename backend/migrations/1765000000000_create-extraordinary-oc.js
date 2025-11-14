/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('ordenes_compra_extraordinarias', {
    id: 'id',
    codigo: { type: 'varchar(32)', notNull: true, unique: true },
    usuario_id: {
      type: 'integer',
      notNull: true,
      references: 'usuarios(id)',
      onDelete: 'RESTRICT',
    },
    status: {
      type: 'varchar(30)',
      notNull: true,
      default: 'BORRADOR',
      comment: 'BORRADOR | EN_REVISION | APROBADA | RECHAZADA',
    },
    datos_generales: { type: 'jsonb', notNull: true },
    materiales: { type: 'jsonb', notNull: true },
    configuraciones: { type: 'jsonb', notNull: true },
    totales: { type: 'jsonb', notNull: true },
    historial: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('ordenes_compra_extraordinarias', 'status');
  pgm.createIndex('ordenes_compra_extraordinarias', 'creado_en');

  pgm.createSequence('ordenes_compra_extraordinarias_codigo_seq', { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropSequence('ordenes_compra_extraordinarias_codigo_seq', { ifExists: true });
  pgm.dropTable('ordenes_compra_extraordinarias', { ifExists: true });
};
