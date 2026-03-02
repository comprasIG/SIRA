/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
// Esta migración crea las tablas necesarias para gestionar empresas, áreas, puestos, departamentos de recursos humanos y status de trabajadores en el sistema.
exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Tabla Empresas
  pgm.createTable('empresas', {
    id: 'id',
    razon_social: { type: 'varchar(255)', notNull: true },
    nombre_comercial: { type: 'varchar(255)' },
    rfc: { type: 'varchar(13)', notNull: true, unique: true },
    telefono: { type: 'varchar(20)' },
    email: { type: 'varchar(255)' },
    creado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actualizado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // 2. Tabla Áreas
  pgm.createTable('areas', {
    id: 'id',
    nombre_area: { type: 'varchar(100)', notNull: true },
    creado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actualizado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // 3. Tabla Puestos
  pgm.createTable('puestos', {
    id: 'id',
    nombre_puesto: { type: 'varchar(100)', notNull: true },
    creado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actualizado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // 4. Tabla Departamentos RH
  pgm.createTable('departamentos_rh', {
    id: 'id',
    codigo: { type: 'varchar(20)', unique: true },
    nombre: { type: 'varchar(100)', notNull: true },
    creado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actualizado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // 5. Tabla Status Trabajador
  pgm.createTable('status_trabajador', {
    id: 'id',
    nombre_status: { type: 'varchar(50)', notNull: true },
    creado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actualizado_en: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('status_trabajador');
  pgm.dropTable('departamentos_rh');
  pgm.dropTable('puestos');
  pgm.dropTable('areas');
  pgm.dropTable('empresas');
};
