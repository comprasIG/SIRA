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

// Tabla catálogo para los tipos de incidencia
  pgm.createTable('catalogo_incidencias_recepcion', {
    id: 'id',
    codigo: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
      comment: 'Código corto para referencia interna (ej: DANO, CANT_INCORRECTA)',
    },
    descripcion: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Descripción legible para el usuario',
    },
    activo: { type: 'boolean', default: true },
  }, { ifNotExists: true });

  // Insertar tipos básicos de incidencia
  pgm.sql(`
    INSERT INTO catalogo_incidencias_recepcion (codigo, descripcion) VALUES
    ('DANO', 'Material Dañado'),
    ('CANT_INCORRECTA', 'Cantidad Incorrecta (menor o mayor a la esperada)'),
    ('ITEM_EQUIVOCADO', 'Ítem Equivocado (no corresponde a lo solicitado)')
    ON CONFLICT (codigo) DO NOTHING;
  `);

  // Tabla para registrar las incidencias específicas
  pgm.createTable('incidencias_recepcion_oc', {
    id: 'id',
    // Quitamos la FK a ordenes_compra_detalle_id por si el problema aplica a toda la OC o no se identifica un item
    orden_compra_id: {
        type: 'integer',
        notNull: true,
        references: '"ordenes_compra"',
        onDelete: 'CASCADE'
    },
    incidencia_id: {
      type: 'integer',
      notNull: true,
      references: '"catalogo_incidencias_recepcion"', // FK al catálogo
      onDelete: 'RESTRICT', // No permitir borrar un tipo si está en uso
    },
    cantidad_afectada: {
      type: 'numeric(12, 2)',
      comment: 'Cantidad del material afectado (opcional, si aplica a un ítem)',
    },
    descripcion_problema: {
      type: 'text',
      notNull: true,
      comment: 'Descripción detallada del problema por el usuario',
    },
    fecha_registro: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    usuario_id: {
      type: 'integer',
      references: '"usuarios"', // Quién registró la incidencia
      onDelete: 'SET NULL',
    },
     material_id: { // Opcional: Para saber qué material tuvo el problema si aplica
        type: 'integer',
        references: '"catalogo_materiales"',
        onDelete: 'SET NULL'
    },
  }, { ifNotExists: true });

  pgm.createIndex('incidencias_recepcion_oc', 'orden_compra_id', { ifNotExists: true });
  pgm.createIndex('incidencias_recepcion_oc', 'incidencia_id', { ifNotExists: true });
  pgm.createIndex('incidencias_recepcion_oc', 'material_id', { ifNotExists: true });

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

pgm.dropIndex('incidencias_recepcion_oc', 'orden_compra_id', { ifExists: true });
  pgm.dropIndex('incidencias_recepcion_oc', 'incidencia_id', { ifExists: true });
  pgm.dropIndex('incidencias_recepcion_oc', 'material_id', { ifExists: true });
  pgm.dropTable('incidencias_recepcion_oc', { ifExists: true });
  pgm.dropTable('catalogo_incidencias_recepcion', { ifExists: true });

};
