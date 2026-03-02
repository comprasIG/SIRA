/**
 * Migración: Tablas de soporte para el módulo de Incrementables de Importación
 *
 * A) incrementables_distribucion_items — distribución por artículo de los costos incrementables
 * B) ALTER ordenes_compra_detalle.material_id → nullable (para líneas de servicio incrementable)
 * C) inventario_actual.costos_incrementables JSONB — acumulador multi-moneda de landed costs
 */

exports.shorthands = undefined;

const { grant_block } = require('./_helpers/grants');

exports.up = (pgm) => {
  // ── A) Tabla de distribución por artículo ─────────────────────────────────
  pgm.createTable('incrementables_distribucion_items', {
    id: 'id',

    incrementable_id: {
      type: 'integer',
      notNull: true,
      references: 'incrementables_oc(id)',
      onDelete: 'CASCADE',
    },
    aplicacion_id: {
      type: 'integer',
      notNull: true,
      references: 'incrementables_oc_aplicaciones(id)',
      onDelete: 'CASCADE',
    },
    oc_base_id: {
      type: 'integer',
      notNull: true,
      references: 'ordenes_compra(id)',
      onDelete: 'RESTRICT',
    },
    oc_detalle_id: {
      type: 'integer',
      notNull: true,
      references: 'ordenes_compra_detalle(id)',
      onDelete: 'RESTRICT',
    },
    material_id: {
      type: 'integer',
      notNull: true,
      references: 'catalogo_materiales(id)',
      onDelete: 'RESTRICT',
    },

    // Costo base para calcular peso proporcional
    costo_base:           { type: 'numeric(14,4)', notNull: true },
    moneda_base:          { type: 'bpchar(3)', notNull: false, references: 'catalogo_monedas(codigo)', onDelete: 'SET NULL' },
    tipo_cambio_mxn:      { type: 'numeric(14,6)', notNull: false },        // TC para convertir moneda_base → MXN
    costo_base_mxn_equiv: { type: 'numeric(14,4)', notNull: false },        // costo_base × tipo_cambio_mxn

    // Proporción y monto asignado
    porcentaje_asignado:  { type: 'numeric(10,8)', notNull: true },         // 0.0 – 1.0
    monto_incrementable:  { type: 'numeric(14,4)', notNull: true },         // fracción del total del incrementable
    moneda_incrementable: { type: 'bpchar(3)', notNull: false, references: 'catalogo_monedas(codigo)', onDelete: 'SET NULL' },

    // Estado de aplicación al inventario
    aplicado_en:  { type: 'timestamptz', notNull: false },                  // NULL = pendiente, NOT NULL = aplicado

    creado_en:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('incrementables_distribucion_items', 'incrementable_id');
  pgm.createIndex('incrementables_distribucion_items', 'oc_base_id');
  pgm.createIndex('incrementables_distribucion_items', 'material_id');
  pgm.createIndex('incrementables_distribucion_items', 'aplicado_en');

  pgm.sql(`
    CREATE TRIGGER trg_incrementables_distribucion_items_update
    BEFORE UPDATE ON public.incrementables_distribucion_items
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // ── B) Hacer material_id nullable en ordenes_compra_detalle ───────────────
  // Permite insertar líneas de "servicio" para OC incrementables sin material real
  pgm.sql(`
    ALTER TABLE public.ordenes_compra_detalle
      ALTER COLUMN material_id DROP NOT NULL;
  `);

  // ── C) Columna JSONB en inventario_actual para costos incrementales multi-moneda ──
  pgm.sql(`
    ALTER TABLE public.inventario_actual
      ADD COLUMN IF NOT EXISTS costos_incrementables JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  // Permisos
  pgm.sql(grant_block({
    tables: ['incrementables_distribucion_items'],
    sequences: ['incrementables_distribucion_items_id_seq'],
  }));
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_incrementables_distribucion_items_update
    ON public.incrementables_distribucion_items;
  `);
  pgm.dropTable('incrementables_distribucion_items');

  pgm.sql(`
    ALTER TABLE public.ordenes_compra_detalle
      ALTER COLUMN material_id SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE public.inventario_actual
      DROP COLUMN IF EXISTS costos_incrementables;
  `);
};
