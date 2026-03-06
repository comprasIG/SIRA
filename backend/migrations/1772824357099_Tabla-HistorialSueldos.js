/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

exports.up = (pgm) => {
  // 1. Crear la tabla historial_sueldos
  pgm.createTable('historial_sueldos', {
    id: 'id',
    empleado_id: {
      type: 'integer',
      notNull: true,
      references: '"empleados"',
      onDelete: 'RESTRICT', // Evita borrar empleados que tienen historial de nómina
    },
    monto: { type: 'numeric(10, 2)', notNull: true },
    fecha_inicio: { type: 'date', notNull: true },
    fecha_fin: { type: 'date' }, // NULL si es el vigente
    motivo_cambio: { type: 'varchar(255)', notNull: true },
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

  // 2. Agregar Trigger de actualización para historial_sueldos
  pgm.createTrigger('historial_sueldos', 'tr_actualizar_fecha_sueldos', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'actualizar_fecha_modificacion',
  });

  // 3. Agregar columnas de bandas salariales a la tabla puestos
  pgm.addColumns('puestos', {
    sueldo_minimo: { type: 'numeric(10, 2)', default: 0.00 },
    sueldo_maximo: { type: 'numeric(10, 2)', default: 0.00 },
  });

  // 4. Índice para búsquedas rápidas de nómina
  pgm.createIndex('historial_sueldos', ['empleado_id', 'fecha_inicio']);
};

exports.down = (pgm) => {
  pgm.dropColumns('puestos', ['sueldo_minimo', 'sueldo_maximo']);
  pgm.dropTable('historial_sueldos');
};
