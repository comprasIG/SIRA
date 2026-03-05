/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

exports.up = (pgm) => {
  // Eliminamos todas las columnas que ya fueron migradas a periodos_laborales
  pgm.dropColumns('empleados', [
    'fecha_ingreso',
    'fecha_reingreso',
    'empresa_id',
    'area_id',
    'puesto_id',
    'departamento_rh_id',
    'status_trabajador_id'
  ]);
};

exports.down = (pgm) => {
  // Recreamos las columnas y sus tipos en caso de rollback
  pgm.addColumns('empleados', {
    fecha_ingreso: { type: 'date' },
    fecha_reingreso: { type: 'date' },
    empresa_id: { 
      type: 'integer', 
      references: '"empresas"', 
      onDelete: 'SET NULL' 
    },
    area_id: { 
      type: 'integer', 
      references: '"areas"', 
      onDelete: 'SET NULL' 
    },
    puesto_id: { 
      type: 'integer', 
      references: '"puestos"', 
      onDelete: 'SET NULL' 
    },
    departamento_rh_id: { 
      type: 'integer', 
      references: '"departamentos_rh"', 
      onDelete: 'SET NULL' 
    },
    status_trabajador_id: { 
      type: 'integer', 
      references: '"status_trabajador"', 
      onDelete: 'SET NULL' 
    }
  });
};
