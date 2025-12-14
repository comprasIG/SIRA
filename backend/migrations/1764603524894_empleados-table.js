/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */

// Crear tabla empleados
export const up = (pgm) => {
  pgm.createTable('empleados', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    num_empl: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    empleado: {
      type: 'varchar(255)',
      notNull: true,
    },
    fecha_ingreso: {
      type: 'date',
      notNull: true,
    },
    rfc: {
      type: 'varchar(15)',
      notNull: true,
      unique: true,
    },
    nss: {
      type: 'varchar(15)',
      notNull: true,
      unique: true,
    },
    curp: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    genero: {
      type: 'varchar(20)',
      notNull: true,
    },
    fecha_nacimiento: {
      type: 'date',
      notNull: true,
    },
    años: {
      type: 'integer',
      check: "años >= 0 AND años <= 100",
    },
    empresa: {
      type: 'varchar(255)',
      notNull: true,
    },
    puesto: {
      type: 'varchar(255)',
      notNull: true,
    },
    departamento: {
      type: 'varchar(255)',
      notNull: true,
    },
    status_laboral: {
      type: 'varchar(50)',
      default: 'activo',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp'),
      notNull: true,
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp'),
      notNull: true,
    }
  });

  // Constraints de CHECK
  pgm.addConstraint('empleados', 'chk_genero_valido', {
    check: "genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO ESPECIFICADO')"
  });

  pgm.addConstraint('empleados', 'chk_status_laboral_valido', {
    check: "status_laboral IN ('activo', 'inactivo', 'vacaciones', 'licencia', 'baja')"
  });

  pgm.addConstraint('empleados', 'chk_fecha_nacimiento_valida', {
    check: "fecha_nacimiento <= CURRENT_DATE"
  });

  pgm.addConstraint('empleados', 'chk_fecha_ingreso_valida', {
    check: "fecha_ingreso <= CURRENT_DATE"
  });

  pgm.addConstraint('empleados', 'chk_edad_minima', {
    check: "fecha_nacimiento <= (CURRENT_DATE - INTERVAL '18 years')"
  });

  // Constraints de UNIQUE compuestas si es necesario
  pgm.addConstraint('empleados', 'uq_empleado_empresa', {
    unique: ['num_empl', 'empresa']
  });

  // Índices para mejorar el rendimiento
  pgm.createIndex('empleados', 'num_empl');
  pgm.createIndex('empleados', 'rfc');
  pgm.createIndex('empleados', 'nss');
  pgm.createIndex('empleados', 'curp');
  pgm.createIndex('empleados', 'departamento');
  pgm.createIndex('empleados', 'status_laboral');
  pgm.createIndex('empleados', 'empresa');
  pgm.createIndex('empleados', 'fecha_ingreso');
  pgm.createIndex('empleados', ['empresa', 'departamento']);
  pgm.createIndex('empleados', ['status_laboral', 'empresa']);

  // Comentarios sobre la tabla y columnas (opcional pero recomendado)
  pgm.sql(`
    COMMENT ON TABLE empleados IS 'Tabla para almacenar información de empleados';
    COMMENT ON COLUMN empleados.id IS 'Identificador único autoincremental del empleado';
    COMMENT ON COLUMN empleados.num_empl IS 'Número de empleado único por empresa';
    COMMENT ON COLUMN empleados.empleado IS 'Nombre completo del empleado';
    COMMENT ON COLUMN empleados.fecha_ingreso IS 'Fecha de ingreso a la empresa';
    COMMENT ON COLUMN empleados.rfc IS 'RFC único del empleado (13 caracteres)';
    COMMENT ON COLUMN empleados.nss IS 'Número de Seguridad Social único (11 caracteres)';
    COMMENT ON COLUMN empleados.curp IS 'CURP único del empleado (18 caracteres)';
    COMMENT ON COLUMN empleados.genero IS 'Género del empleado: MASCULINO, FEMENINO, OTRO, NO ESPECIFICADO';
    COMMENT ON COLUMN empleados.fecha_nacimiento IS 'Fecha de nacimiento del empleado';
    COMMENT ON COLUMN empleados.años IS 'Edad del empleado en años (0-100)';
    COMMENT ON COLUMN empleados.empresa IS 'Nombre de la empresa donde labora';
    COMMENT ON COLUMN empleados.puesto IS 'Puesto del empleado';
    COMMENT ON COLUMN empleados.departamento IS 'Departamento o área del empleado';
    COMMENT ON COLUMN empleados.status_laboral IS 'Estado laboral: activo, inactivo, vacaciones, licencia, baja';
    COMMENT ON COLUMN empleados.created_at IS 'Fecha y hora de creación del registro';
    COMMENT ON COLUMN empleados.updated_at IS 'Fecha y hora de última actualización del registro';
  `);
};

export const down = (pgm) => {
  // Eliminar índices primero
  pgm.dropIndex('empleados', ['status_laboral', 'empresa']);
  pgm.dropIndex('empleados', ['empresa', 'departamento']);
  pgm.dropIndex('empleados', 'fecha_ingreso');
  pgm.dropIndex('empleados', 'empresa');
  pgm.dropIndex('empleados', 'status_laboral');
  pgm.dropIndex('empleados', 'departamento');
  pgm.dropIndex('empleados', 'curp');
  pgm.dropIndex('empleados', 'nss');
  pgm.dropIndex('empleados', 'rfc');
  pgm.dropIndex('empleados', 'num_empl');
  
  // Eliminar constraints
  pgm.dropConstraint('empleados', 'uq_empleado_empresa');
  pgm.dropConstraint('empleados', 'chk_edad_minima');
  pgm.dropConstraint('empleados', 'chk_fecha_ingreso_valida');
  pgm.dropConstraint('empleados', 'chk_fecha_nacimiento_valida');
  pgm.dropConstraint('empleados', 'chk_status_laboral_valido');
  pgm.dropConstraint('empleados', 'chk_genero_valido');
  
  // Finalmente eliminar la tabla
  pgm.dropTable('empleados');
};
