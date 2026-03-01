/**
 * Objetivo (Prompt #3):
 * - Extender public.catalogo_materiales con dimensiones/peso y sus unidades como FK a public.catalogo_unidades.
 * - Agregar cantidad_uso + unidad_uso (para casos de "entra paquete / sale por pieza").
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1) Agregar columnas (NULLables para no romper datos existentes)
  pgm.addColumns('catalogo_materiales', {
    ancho: { type: 'numeric(12,4)', notNull: false },
    ancho_unidad_id: { type: 'integer', notNull: false },

    altura: { type: 'numeric(12,4)', notNull: false },
    altura_unidad_id: { type: 'integer', notNull: false },

    longitud: { type: 'numeric(12,4)', notNull: false },
    longitud_unidad_id: { type: 'integer', notNull: false },

    peso: { type: 'numeric(12,4)', notNull: false },
    peso_unidad_id: { type: 'integer', notNull: false },

    cantidad_uso: { type: 'numeric(12,4)', notNull: false },
    unidad_uso_id: { type: 'integer', notNull: false },
  });

  // 2) FKs a catalogo_unidades (todas las unidades deben ser FK, según prompt)
  pgm.addConstraint('catalogo_materiales', 'fk_mat_ancho_unidad', {
    foreignKeys: [{ columns: 'ancho_unidad_id', references: 'catalogo_unidades(id)', onDelete: 'SET NULL' }],
  });
  pgm.addConstraint('catalogo_materiales', 'fk_mat_altura_unidad', {
    foreignKeys: [{ columns: 'altura_unidad_id', references: 'catalogo_unidades(id)', onDelete: 'SET NULL' }],
  });
  pgm.addConstraint('catalogo_materiales', 'fk_mat_longitud_unidad', {
    foreignKeys: [{ columns: 'longitud_unidad_id', references: 'catalogo_unidades(id)', onDelete: 'SET NULL' }],
  });
  pgm.addConstraint('catalogo_materiales', 'fk_mat_peso_unidad', {
    foreignKeys: [{ columns: 'peso_unidad_id', references: 'catalogo_unidades(id)', onDelete: 'SET NULL' }],
  });
  pgm.addConstraint('catalogo_materiales', 'fk_mat_unidad_uso', {
    foreignKeys: [{ columns: 'unidad_uso_id', references: 'catalogo_unidades(id)', onDelete: 'SET NULL' }],
  });

  // 3) Checks (solo si hay valor, debe ser >= 0)
  pgm.addConstraint('catalogo_materiales', 'chk_mat_ancho_nonneg', { check: '(ancho IS NULL) OR (ancho >= 0)' });
  pgm.addConstraint('catalogo_materiales', 'chk_mat_altura_nonneg', { check: '(altura IS NULL) OR (altura >= 0)' });
  pgm.addConstraint('catalogo_materiales', 'chk_mat_longitud_nonneg', { check: '(longitud IS NULL) OR (longitud >= 0)' });
  pgm.addConstraint('catalogo_materiales', 'chk_mat_peso_nonneg', { check: '(peso IS NULL) OR (peso >= 0)' });
  pgm.addConstraint('catalogo_materiales', 'chk_mat_cantidad_uso_nonneg', { check: '(cantidad_uso IS NULL) OR (cantidad_uso >= 0)' });

  // Opcional: índices por si filtras por unidad_uso_id, etc.
  pgm.createIndex('catalogo_materiales', 'unidad_uso_id');
};

exports.down = (pgm) => {
  // Quitar constraints
  pgm.dropConstraint('catalogo_materiales', 'chk_mat_cantidad_uso_nonneg');
  pgm.dropConstraint('catalogo_materiales', 'chk_mat_peso_nonneg');
  pgm.dropConstraint('catalogo_materiales', 'chk_mat_longitud_nonneg');
  pgm.dropConstraint('catalogo_materiales', 'chk_mat_altura_nonneg');
  pgm.dropConstraint('catalogo_materiales', 'chk_mat_ancho_nonneg');

  pgm.dropConstraint('catalogo_materiales', 'fk_mat_unidad_uso');
  pgm.dropConstraint('catalogo_materiales', 'fk_mat_peso_unidad');
  pgm.dropConstraint('catalogo_materiales', 'fk_mat_longitud_unidad');
  pgm.dropConstraint('catalogo_materiales', 'fk_mat_altura_unidad');
  pgm.dropConstraint('catalogo_materiales', 'fk_mat_ancho_unidad');

  // Quitar índice opcional
  pgm.dropIndex('catalogo_materiales', 'unidad_uso_id');

  // Quitar columnas
  pgm.dropColumns('catalogo_materiales', [
    'ancho', 'ancho_unidad_id',
    'altura', 'altura_unidad_id',
    'longitud', 'longitud_unidad_id',
    'peso', 'peso_unidad_id',
    'cantidad_uso', 'unidad_uso_id',
  ]);
};
