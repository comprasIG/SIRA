/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Crear la tabla Nivel_Academico
  pgm.createTable('nivel_academico', {
    id: 'id',
    nivel: { type: 'varchar(100)', notNull: true },
    creado_en: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('current_timestamp') 
    },
    actualizado_en: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('current_timestamp') 
    },
  });

  // 2. Agregar el Trigger para actualizado_en (usando la función que creamos antes)
  pgm.createTrigger('nivel_academico', 'tr_actualizar_fecha_nivel_academico', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'actualizar_fecha_modificacion',
  });

  // 3. Agregar la columna FK a la tabla empleados
  pgm.addColumn('empleados', {
    nivel_academico_id: {
      type: 'integer',
      references: '"nivel_academico"',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  });

  // 4. Crear índice para optimizar búsquedas por nivel académico
  pgm.createIndex('empleados', 'nivel_academico_id');
};

exports.down = (pgm) => {
  // El orden inverso es importante para evitar errores de dependencia
  pgm.dropColumn('empleados', 'nivel_academico_id');
  pgm.dropTable('nivel_academico');
};
