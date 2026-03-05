/* backend/migrations/1772723810176_activo-fijo-catalogo-materiales.js
 *
 * Propósito:
 *   Permite marcar un material del catálogo como "activo fijo", indicando que
 *   al recibirlo vía ING_OC debe crear un registro en activos_fisicos en lugar
 *   de ingresar al inventario de stock.
 *
 * Cambios:
 *   1. catalogo_materiales: columnas es_activo_fijo, activo_fisico_categoria_id,
 *      activo_fisico_tipo_id
 *   2. activos_fisicos: columna origen_oc_detalle_id (trazabilidad)
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1) Columnas en catalogo_materiales
  pgm.addColumns('catalogo_materiales', {
    es_activo_fijo: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    activo_fisico_categoria_id: {
      type: 'int4',
      references: 'catalogo_activo_fisico_categorias(id)',
      onDelete: 'SET NULL',
    },
    activo_fisico_tipo_id: {
      type: 'int4',
      references: 'catalogo_activo_fisico_tipos(id)',
      onDelete: 'SET NULL',
    },
  });

  // Índice para búsquedas de materiales AF
  pgm.createIndex('catalogo_materiales', ['es_activo_fijo'], {
    name: 'idx_catalogo_materiales_es_activo_fijo',
    where: 'es_activo_fijo = true',
  });

  // 2) Columna de trazabilidad en activos_fisicos
  pgm.addColumns('activos_fisicos', {
    origen_oc_detalle_id: {
      type: 'int4',
      references: 'ordenes_compra_detalle(id)',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('activos_fisicos', ['origen_oc_detalle_id'], {
    name: 'idx_activos_fisicos_origen_oc_detalle',
    where: 'origen_oc_detalle_id IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('activos_fisicos', ['origen_oc_detalle_id'], { name: 'idx_activos_fisicos_origen_oc_detalle', ifExists: true });
  pgm.dropColumns('activos_fisicos', ['origen_oc_detalle_id']);

  pgm.dropIndex('catalogo_materiales', ['es_activo_fijo'], { name: 'idx_catalogo_materiales_es_activo_fijo', ifExists: true });
  pgm.dropColumns('catalogo_materiales', ['es_activo_fijo', 'activo_fisico_categoria_id', 'activo_fisico_tipo_id']);
};
