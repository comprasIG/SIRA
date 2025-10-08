//C:\SIRA\SIRA\backend\migrations\1759867591032_crear-catalogos-y-campos-recoleccion.js
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

  // 1. Catálogo de métodos de recolección
  pgm.createTable('catalogo_metodos_recoleccion', {
    id: { type: 'serial', primaryKey: true },
    codigo: { type: 'varchar(20)', notNull: true, unique: true, comment: 'Clave interna para lógica. Ej: LOCAL, PAQUETERIA, ENTREGA' },
    nombre: { type: 'varchar(100)', notNull: true, comment: 'Nombre visible para usuarios' },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  // 2. Catálogo de paqueterías
  pgm.createTable('catalogo_paqueterias', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(100)', notNull: true, unique: true },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  // 3. Catálogo de métodos de notificación a proveedor
  pgm.createTable('catalogo_metodos_notificacion', {
    id: { type: 'serial', primaryKey: true },
    codigo: { type: 'varchar(20)', notNull: true, unique: true, comment: 'WHATSAPP, EMAIL, OTRO' },
    nombre: { type: 'varchar(100)', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  // 4. Campos nuevos en proveedores
  pgm.addColumns('proveedores', {
    whatsapp_notificaciones: { type: 'varchar(30)', notNull: false, comment: 'Teléfono WhatsApp para notificaciones automatizadas' },
    correo_notificaciones:   { type: 'varchar(150)', notNull: false, comment: 'Correo alternativo para notificaciones' }
  });

  // 5. Campos nuevos en ordenes_compra (referencias a catálogos y control paquetería)
  pgm.addColumns('ordenes_compra', {
    metodo_recoleccion_id:        { type: 'integer', references: 'catalogo_metodos_recoleccion', notNull: false },
    paqueteria_id:                { type: 'integer', references: 'catalogo_paqueterias', notNull: false },
    notificacion_proveedor_metodo_id: { type: 'integer', references: 'catalogo_metodos_notificacion', notNull: false },
    comentario_recoleccion:       { type: 'text', notNull: false, comment: 'Comentario o instrucciones especiales para la recolección' },
    recoleccion_parcial:          { type: 'boolean', notNull: true, default: false },
    paqueteria_pago: {
      type: 'varchar(20)', notNull: false, comment: '¿Por cobrar (paga al recibir) o pagada por proveedor? Valores: POR_COBRAR, PAGADA_POR_PROVEEDOR'
    }
  });

  // 6. Tabla de archivos de recolección por OC
  pgm.createTable('archivos_recoleccion_oc', {
    id: { type: 'serial', primaryKey: true },
    orden_compra_id: { type: 'integer', references: 'ordenes_compra', notNull: true, onDelete: 'cascade' },
    archivo_link:    { type: 'text', notNull: true, comment: 'Link a archivo en Drive' },
    tipo:            { type: 'varchar(30)', notNull: false, comment: 'Tipo de archivo: GUIA, EVIDENCIA, etc.' },
    creado_en:       { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  // 7. Agregar índices útiles (busquedas/filtros)
  pgm.createIndex('ordenes_compra', 'metodo_recoleccion_id');
  pgm.createIndex('ordenes_compra', 'paqueteria_id');
  pgm.createIndex('ordenes_compra', 'notificacion_proveedor_metodo_id');
  pgm.createIndex('archivos_recoleccion_oc', 'orden_compra_id');

  // 8. Insertar valores iniciales en catálogos (puedes editar después)
  pgm.sql(`
    INSERT INTO catalogo_metodos_recoleccion (codigo, nombre) VALUES
      ('LOCAL', 'Recolección local'),
      ('PAQUETERIA', 'Paquetería'),
      ('ENTREGA', 'Entrega en instalaciones');

    INSERT INTO catalogo_paqueterias (nombre) VALUES
      ('FedEx'), ('DHL'), ('Estafeta'), ('99Minutos'), ('Paquetexpress');

    INSERT INTO catalogo_metodos_notificacion (codigo, nombre) VALUES
      ('WHATSAPP', 'WhatsApp'),
      ('EMAIL', 'Correo electrónico');
  `);

    
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

 // Elimina índices (si existen)
  pgm.dropIndex('archivos_recoleccion_oc', 'orden_compra_id', { ifExists: true });
  pgm.dropIndex('ordenes_compra', 'metodo_recoleccion_id', { ifExists: true });
  pgm.dropIndex('ordenes_compra', 'paqueteria_id', { ifExists: true });
  pgm.dropIndex('ordenes_compra', 'notificacion_proveedor_metodo_id', { ifExists: true });

  // Elimina tabla de archivos de recolección
  pgm.dropTable('archivos_recoleccion_oc', { ifExists: true });

  // Elimina columnas de ordenes_compra (en orden inverso al agregado)
  pgm.dropColumns('ordenes_compra', [
    'paqueteria_pago',
    'recoleccion_parcial',
    'comentario_recoleccion',
    'notificacion_proveedor_metodo_id',
    'paqueteria_id',
    'metodo_recoleccion_id'
  ]);

  // Elimina columnas de proveedores
  pgm.dropColumns('proveedores', [
    'whatsapp_notificaciones',
    'correo_notificaciones'
  ]);

  // Elimina catálogos
  pgm.dropTable('catalogo_metodos_notificacion', { ifExists: true });
  pgm.dropTable('catalogo_paqueterias', { ifExists: true });
  pgm.dropTable('catalogo_metodos_recoleccion', { ifExists: true });


};
