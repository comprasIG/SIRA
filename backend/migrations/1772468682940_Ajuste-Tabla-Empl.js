/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */

// Esta migración ajusta la tabla "empleados" para incluir nuevas columnas que permiten establecer relaciones con otras tablas (empresas, áreas, puestos, departamentos de recursos humanos y status del trabajador), así como campos adicionales para almacenar información relevante como la fecha de reingreso y la fotografía del empleado. Además, se crean índices para optimizar las consultas basadas en estas nuevas columnas.
exports.up = (pgm) => {
  pgm.addColumns('empleados', {
    // Relaciones de llaves foráneas
    empresa_id: {
      type: 'integer',
      references: '"empresas"',
      onDelete: 'SET NULL',
    },
    area_id: {
      type: 'integer',
      references: '"areas"',
      onDelete: 'SET NULL',
    },
    puesto_id: {
      type: 'integer',
      references: '"puestos"',
      onDelete: 'SET NULL',
    },
    departamento_rh_id: {
      type: 'integer',
      references: '"departamentos_rh"',
      onDelete: 'SET NULL',
    },
    status_trabajador_id: {
      type: 'integer',
      references: '"status_trabajador"',
      onDelete: 'SET NULL',
    },
    // Campos de información adicional
    fecha_reingreso: {
      type: 'date',
      notNull: false,
    },
    // Campo para la fotografía
    foto_emp: {
      type: 'text', // Almacena la URL o ruta del archivo
      notNull: false,
    }
  });

  // Índices para optimizar las búsquedas por estas nuevas columnas
  pgm.createIndex('empleados', ['empresa_id', 'area_id', 'puesto_id', 'status_trabajador_id']);
};

exports.down = (pgm) => {
  pgm.dropColumns('empleados', [
    'empresa_id',
    'area_id',
    'puesto_id',
    'departamento_rh_id',
    'status_trabajador_id',
    'fecha_reingreso',
    'foto_emp'
  ]);
};