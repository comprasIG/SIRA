/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('periodos_laborales', {
    id: 'id', // Esto crea un SERIAL PRIMARY KEY automáticamente
    
    // Llaves Foráneas (Relaciones)
    empleado_id: {
      type: 'integer',
      references: '"empleados"',
      onDelete: 'CASCADE', // Si se borra el empleado, se borra su historial
      notNull: true
    },
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
    departamento_rh_id: {
      type: 'integer',
      references: '"departamentos_rh"',
      onDelete: 'SET NULL'
    },
    puesto_id: {
      type: 'integer',
      references: '"puestos"',
      onDelete: 'SET NULL'
    },
    status_trabajador_id: {
      type: 'integer',
      references: '"status_trabajador"', // Ajustado al nombre que usamos antes
      onDelete: 'SET NULL'
    },

    // Campos de fechas y control
    fecha_ingreso: { type: 'date', notNull: true },
    fecha_baja: { type: 'date' },
    motivo_baja: { type: 'varchar(255)' },
    
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

  // 1. Crear el Trigger para actualizado_en
  pgm.createTrigger('periodos_laborales', 'tr_actualizar_fecha_periodos', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'actualizar_fecha_modificacion',
  });

  // 2. Crear Índices para optimizar reportes históricos
  pgm.createIndex('periodos_laborales', ['empleado_id', 'empresa_id', 'fecha_ingreso']);
};

exports.down = (pgm) => {
  pgm.dropTable('periodos_laborales');
};