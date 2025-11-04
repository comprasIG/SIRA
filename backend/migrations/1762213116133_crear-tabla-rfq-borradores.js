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

// 1. Crear la tabla de borradores de RFQ
  pgm.createTable('rfq_borradores', {
    requisicion_id: {
      type: 'integer',
      notNull: true,
      references: 'requisiciones(id)',
      onDelete: 'CASCADE',
    },
    usuario_id: {
      type: 'integer',
      notNull: true,
      references: 'usuarios(id)',
      onDelete: 'CASCADE',
    },
    data: {
      type: 'jsonb',
      notNull: true,
    },
    actualizado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // 2. Definir la Llave Primaria compuesta
  pgm.addConstraint('rfq_borradores', 'rfq_borradores_pkey', {
    primaryKey: ['requisicion_id', 'usuario_id'],
  });

  // 3. Crear el trigger para actualizar 'actualizado_en' (asumiendo que la función update_timestamp ya existe)
  pgm.createTrigger('rfq_borradores', 'trg_rfq_borradores_update', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_timestamp', // La función que ya usas en otras tablas
    level: 'ROW',
  });

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('rfq_borradores');
};
