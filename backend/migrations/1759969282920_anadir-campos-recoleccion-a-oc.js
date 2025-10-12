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

    // Columnas para gestionar la logística de recolección
  pgm.addColumns('ordenes_compra', {
    metodo_recoleccion_id: {
      type: 'integer',
      references: 'catalogo_metodos_recoleccion(id)',
      onDelete: 'SET NULL',
    },
    paqueteria_id: {
      type: 'integer',
      references: 'catalogo_paqueterias(id)',
      onDelete: 'SET NULL',
    },
    numero_guia: {
      type: 'varchar(100)',
    },
    comentario_recoleccion: {
      type: 'text',
    },
    // Nuevos ENUM para manejar el tipo de pago de la paquetería
    paqueteria_pago: {
      type: 'varchar(50)', // Se usará como ENUM con un CHECK
    },
  });

  // Índices para mejorar el rendimiento de las búsquedas
  pgm.createIndex('ordenes_compra', 'metodo_recoleccion_id');
  pgm.createIndex('ordenes_compra', 'paqueteria_id');

  // Tabla para almacenar los archivos de evidencia (guías, fotos, etc.)
  pgm.createTable('archivos_recoleccion_oc', {
    id: 'id',
    orden_compra_id: {
      type: 'integer',
      notNull: true,
      references: 'ordenes_compra(id)',
      onDelete: 'CASCADE',
    },
    archivo_link: {
      type: 'text',
      notNull: true,
      comment: 'Link al archivo en Google Drive',
    },
    tipo: {
      type: 'varchar(50)', // Ej: GUIA, EVIDENCIA_EMBARQUE
      comment: 'Tipo de archivo para categorización',
    },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('archivos_recoleccion_oc', 'orden_compra_id');

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

 pgm.dropTable('archivos_recoleccion_oc');
  pgm.dropColumns('ordenes_compra', [
    'metodo_recoleccion_id',
    'paqueteria_id',
    'numero_guia',
    'comentario_recoleccion',
    'paqueteria_pago',
  ]);

};
