/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Añade la columna 'departamento_id' a la tabla 'empleados'
  pgm.addColumn('empleados', {
    departamento_id: {
      type: 'integer',
      notNull: false, // Cámbialo a true si es obligatorio
      references: '"departamentos"', // Si tienes una tabla de departamentos
      onDelete: 'SET NULL',         // Comportamiento al borrar un departamento
    },
  });

  // Opcional: Crear un índice para mejorar el rendimiento de los JOINs
  pgm.createIndex('empleados', 'departamento_id');
};

exports.down = (pgm) => {
  // Revierte el cambio eliminando la columna
  pgm.dropColumn('empleados', 'departamento_id');
};
