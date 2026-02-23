/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Crea la restricción de llave foránea (Foreign Key)
  pgm.addConstraint('empleados', 'fk_empleados_departamento', {
    foreignKeys: {
      columns: 'departamento_id',       // Columna en la tabla 'empleados'
      references: 'departamentos(id)',  // Tabla destino y su llave primaria
      onDelete: 'SET NULL',            // Si se borra el depto, el empleado queda con null
      onUpdate: 'CASCADE',             // Si cambia el ID del depto, se actualiza en empleados
    },
  });
};

exports.down = (pgm) => {
  // Elimina la restricción para revertir la migración
  pgm.dropConstraint('empleados', 'fk_empleados_departamento');
};