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

// Use ifNotExists for table and indexes
  pgm.createTable('historial_kpi_tiempos_entrega', {
    id: 'id',
    orden_compra_id: {
      type: 'integer',
      notNull: true,
      references: '"ordenes_compra"',
      onDelete: 'CASCADE',
    },
    fecha_entrada_proceso: {
      type: 'timestamptz',
      notNull: true,
      comment: 'Momento en que la OC pasó a EN_PROCESO',
    },
    fecha_entregada: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
      comment: 'Momento en que la OC pasó a ENTREGADA',
    },
    dias_transcurridos: {
      type: 'numeric',
      notNull: true,
      comment: 'Diferencia en días entre entrada a proceso y entrega',
    },
    metodo_recoleccion_id: {
      type: 'integer',
      references: '"catalogo_metodos_recoleccion"',
      onDelete: 'SET NULL',
    },
    entrega_responsable: {
      type: 'varchar(30)',
    },
  }, { ifNotExists: true }); // Table idempotency

  // Index idempotency
  pgm.createIndex('historial_kpi_tiempos_entrega', 'orden_compra_id', { ifNotExists: true });
  pgm.createIndex('historial_kpi_tiempos_entrega', 'fecha_entregada', { ifNotExists: true });
  pgm.createIndex('historial_kpi_tiempos_entrega', 'metodo_recoleccion_id', { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Use ifExists for dropping table and indexes
  pgm.dropIndex('historial_kpi_tiempos_entrega', 'orden_compra_id', { ifExists: true });
  pgm.dropIndex('historial_kpi_tiempos_entrega', 'fecha_entregada', { ifExists: true });
  pgm.dropIndex('historial_kpi_tiempos_entrega', 'metodo_recoleccion_id', { ifExists: true });
  pgm.dropTable('historial_kpi_tiempos_entrega', { ifExists: true });
};
