/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/**
 * MIGRACIÓN: Salidas de almacén (PICK_IN) con solicitante + detalle
 * =========================================================================================
 * Crea:
 * - salidas_almacen (cabecera)
 * - salidas_almacen_items (detalle)
 * Y agrega:
 * - movimientos_inventario.salida_almacen_id (FK) para ligar kardex con la salida.
 *
 * Motivo:
 * - Necesitamos trazabilidad profesional: quién solicitó, quién ejecutó y qué se retiró.
 */


export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
     // 1) Tabla cabecera
  pgm.createTable('salidas_almacen', {
    id: 'id',
    fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },

    // ASIGNADO | STOCK
    tipo_retiro: { type: 'varchar(20)', notNull: true },

    // Usuario SIRA que ejecutó el retiro (quien está loggeado)
    usuario_id: { type: 'integer', notNull: true, references: 'usuarios(id)', onDelete: 'restrict' },

    // Empleado que solicitó la salida
    solicitante_empleado_id: { type: 'integer', notNull: true, references: 'empleados(id)', onDelete: 'restrict' },

    // Informativo (opción 1: ASIGNADO no captura destino; pero sí guardamos origen si viene)
    sitio_origen_id: { type: 'integer', references: 'sitios(id)', onDelete: 'set null' },
    proyecto_origen_id: { type: 'integer', references: 'proyectos(id)', onDelete: 'set null' },

    // STOCK requiere destino
    sitio_destino_id: { type: 'integer', references: 'sitios(id)', onDelete: 'set null' },
    proyecto_destino_id: { type: 'integer', references: 'proyectos(id)', onDelete: 'set null' },

    observaciones: { type: 'text' },

    estado: { type: 'varchar(20)', notNull: true, default: 'ACTIVA' },
    anulado_en: { type: 'timestamptz' },
    anulado_por: { type: 'integer', references: 'usuarios(id)', onDelete: 'set null' },
    motivo_anulacion: { type: 'text' },
  });

  pgm.createIndex('salidas_almacen', 'fecha');
  pgm.createIndex('salidas_almacen', 'tipo_retiro');
  pgm.createIndex('salidas_almacen', 'usuario_id');
  pgm.createIndex('salidas_almacen', 'solicitante_empleado_id');

  // Checks (ligeros, no enum para evitar locks complicados)
  pgm.addConstraint('salidas_almacen', 'salidas_almacen_tipo_retiro_chk', {
    check: "tipo_retiro IN ('ASIGNADO','STOCK')"
  });

  pgm.addConstraint('salidas_almacen', 'salidas_almacen_estado_chk', {
    check: "estado IN ('ACTIVA','ANULADA')"
  });

  // 2) Tabla detalle
  pgm.createTable('salidas_almacen_items', {
    id: 'id',
    salida_almacen_id: {
      type: 'integer',
      notNull: true,
      references: 'salidas_almacen(id)',
      onDelete: 'cascade',
    },
    material_id: { type: 'integer', notNull: true, references: 'catalogo_materiales(id)', onDelete: 'restrict' },
    ubicacion_id: { type: 'integer', references: 'ubicaciones_almacen(id)', onDelete: 'set null' },
    cantidad: { type: 'numeric(12,4)', notNull: true },
    // Solo aplica cuando sale de asignado
    asignacion_origen_id: { type: 'integer', references: 'inventario_asignado(id)', onDelete: 'set null' },

    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('salidas_almacen_items', 'salida_almacen_id');
  pgm.createIndex('salidas_almacen_items', 'material_id');
  pgm.createIndex('salidas_almacen_items', 'asignacion_origen_id');

  // 3) Ligar movimientos_inventario con salida_almacen
  pgm.addColumn('movimientos_inventario', {
    salida_almacen_id: {
      type: 'integer',
      references: 'salidas_almacen(id)',
      onDelete: 'set null',
    },
  });

  pgm.createIndex('movimientos_inventario', 'salida_almacen_id');

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Revertir en orden inverso
  pgm.dropIndex('movimientos_inventario', 'salida_almacen_id');
  pgm.dropColumn('movimientos_inventario', 'salida_almacen_id');

  pgm.dropTable('salidas_almacen_items');

  pgm.dropConstraint('salidas_almacen', 'salidas_almacen_tipo_retiro_chk');
  pgm.dropConstraint('salidas_almacen', 'salidas_almacen_estado_chk');
  pgm.dropTable('salidas_almacen');

};
