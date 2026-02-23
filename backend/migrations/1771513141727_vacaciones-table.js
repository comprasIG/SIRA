/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // =========================================================
  // CREAR TABLA DE REFERENCIA: dias_ley_vacaciones
  // =========================================================
  pgm.createTable('dias_ley_vacaciones', {
    id: 'id', // Shorthand para serial primary key
    anos_antiguedad: { type: 'integer', notNull: true },
    dias_otorgados: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'), // NOW()
    },
  });

  // Insertar datos iniciales (Ley Federal del Trabajo - México)
  // Usamos pgm.sql para inserciones masivas
  pgm.sql(`
    INSERT INTO dias_ley_vacaciones (anos_antiguedad, dias_otorgados) VALUES 
    (1, 12), (2, 14), (3, 16), (4, 18), (5, 20),
    (6, 22), (7, 22), (8, 22), (9, 22), (10, 22),
    (11, 24), (12, 24), (13, 24), (14, 24), (15, 24),
    (16, 26), (17, 26), (18, 26), (19, 26), (20, 26),
    (21, 28), (22, 28), (23, 28), (24, 28), (25, 28),
    (26, 30), (31, 32);
  `);

  // =========================================================
  // CREAR TABLA TRANSACCIONAL: vacaciones
  // =========================================================
  pgm.createTable('vacaciones', {
    id: 'id',
    empleado_id: {
      type: 'integer',
      notNull: true,
      references: 'empleados', // Llave foránea a tabla empleados
      onDelete: 'CASCADE',     // Si borran al empleado, se borran sus vacaciones
    },
    fecha_solicitud: {
      type: 'timestamp',
      default: pgm.func('current_timestamp'),
    },
    fecha_inicio: { type: 'date', notNull: true },
    fecha_fin: { type: 'date', notNull: true },
    fecha_retorno: { type: 'date' },
    
    dias_solicitados: { type: 'integer', notNull: true },
    
    // Año de antigüedad al que corresponde (ej: 1, 2)
    periodo_antiguedad: { type: 'integer', notNull: true },
    
    estatus: {
      type: 'varchar(20)',
      default: 'Pendiente', // 'Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'
    },
    
    observaciones: { type: 'text' },
    aprobado_por: { type: 'integer' }, // ID del usuario que aprobó
    fecha_aprobacion: { type: 'timestamp' },
    
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Índices para mejorar rendimiento de búsquedas
  pgm.createIndex('vacaciones', 'empleado_id');
  pgm.createIndex('vacaciones', 'estatus');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // El orden es importante al borrar (primero la que tiene la FK)
  pgm.dropTable('vacaciones');
  pgm.dropTable('dias_ley_vacaciones');
};
