/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // 1. Agregar columnas (Si no existen)
  pgm.addColumns('unidades_historial', {
    es_alerta: { type: 'boolean', notNull: true, default: false },
    alerta_cerrada: { type: 'boolean', notNull: true, default: false },
    alerta_cerrada_por: { type: 'integer', default: null, references: '"usuarios"', onDelete: 'SET NULL' },
    alerta_cerrada_en: { type: 'timestamptz', default: null },
  }, { ifNotExists: true }); // <--- IDEMPOTENTE

  // 2. Comentarios
  pgm.sql(`
    COMMENT ON COLUMN public.unidades_historial.es_alerta IS 'Si true, este registro es una incidencia activa que aparece como alerta en el card de la unidad';
    COMMENT ON COLUMN public.unidades_historial.alerta_cerrada IS 'Si true, la alerta fue revisada y cerrada por compras o el responsable';
    COMMENT ON COLUMN public.unidades_historial.alerta_cerrada_por IS 'Usuario que cerró la alerta';
    COMMENT ON COLUMN public.unidades_historial.alerta_cerrada_en IS 'Timestamp en que se cerró la alerta';
  `);

  // 3. Índice Parcial (Si no existe)
  pgm.createIndex('unidades_historial', 'unidad_id', {
    name: 'idx_historial_alertas_abiertas',
    where: 'es_alerta = true AND alerta_cerrada = false',
    ifNotExists: true // <--- IDEMPOTENTE
  });
};

export const down = (pgm) => {
  pgm.dropIndex('unidades_historial', 'unidad_id', { name: 'idx_historial_alertas_abiertas', ifExists: true });
  pgm.dropColumns('unidades_historial', ['es_alerta', 'alerta_cerrada', 'alerta_cerrada_por', 'alerta_cerrada_en'], { ifExists: true });
};