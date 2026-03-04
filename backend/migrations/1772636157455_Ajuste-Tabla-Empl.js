/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

exports.up = (pgm) => {
  // Eliminamos las columnas de texto que ya no son necesarias
  pgm.dropColumns('empleados', ['empresa', 'puesto', 'departamento']);
};

exports.down = (pgm) => {
  // En caso de rollback, las volvemos a crear como varchar
  pgm.addColumns('empleados', {
    empresa: { type: 'varchar(255)' },
    puesto: { type: 'varchar(255)' },
    departamento: { type: 'varchar(255)' },
  });
};