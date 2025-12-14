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
    pgm.createTable('unidades_historial', {
    id: 'id',
    unidad_id: { type: 'integer', notNull: true },
    fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    kilometraje: { type: 'integer', notNull: true },
    evento_tipo_id: { type: 'integer', notNull: true },
    descripcion: { type: 'text' },
    costo_total: { type: 'numeric(14, 4)' },
    numeros_serie: { type: 'text' }, // Para llantas, baterías, etc.
    usuario_id: { type: 'integer' }, // Quién registró
    requisicion_id: { type: 'integer' }, // La req que originó el evento
    orden_compra_id: { type: 'integer' }, // La OC que cerró el evento
  });

  // --- Constraints (Llaves Foráneas) ---
  pgm.addConstraint('unidades_historial', 'fk_historial_unidad', {
    foreignKeys: { columns: 'unidad_id', references: 'unidades(id)' },
  });
  
  pgm.addConstraint('unidades_historial', 'fk_historial_evento_tipo', {
    foreignKeys: { columns: 'evento_tipo_id', references: 'unidades_evento_tipos(id)' },
  });
  
  pgm.addConstraint('unidades_historial', 'fk_historial_usuario', {
    foreignKeys: { columns: 'usuario_id', references: 'usuarios(id)' },
  });
  
  pgm.addConstraint('unidades_historial', 'fk_historial_requisicion', {
    foreignKeys: { columns: 'requisicion_id', references: 'requisiciones(id)' },
  });

  pgm.addConstraint('unidades_historial', 'fk_historial_oc', {
    foreignKeys: { columns: 'orden_compra_id', references: 'ordenes_compra(id)' },
  });

  // --- Índices para búsquedas rápidas ---
  pgm.createIndex('unidades_historial', 'unidad_id');
  pgm.createIndex('unidades_historial', 'orden_compra_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('unidades_historial');
  // No es necesario borrar los tipos de evento ni las columnas de unidades
  // si solo revertimos esta tabla.
};
