/**
 * Objetivo (Prompt #7):
 * - Crear tipos de incrementables.
 * - Crear estructura para relacionar una OC "incrementable" (flete/impuestos/etc.) con 1..n OC base de importación.
 *
 * Diseño:
 * - public.tipo_incrementables: catálogo (id, nombre, código)
 * - public.incrementables_oc: registro del incrementable (tipo + OC que representa el costo)
 * - public.incrementables_oc_aplicaciones: a qué OC(s) de importación aplica + requisición origen (derivable de ordenes_compra.rfq_id)
 */

exports.shorthands = undefined;


const { grant_block } = require('./_helpers/grants');
exports.up = (pgm) => {
  // 1) Catálogo de tipos de incrementables
  pgm.createTable('tipo_incrementables', {
    id: 'id',
    codigo: { type: 'varchar(30)', notNull: true },
    nombre: { type: 'varchar(120)', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('tipo_incrementables', 'uq_tipo_incrementables_codigo', { unique: ['codigo'] });

  pgm.sql(`
    CREATE TRIGGER trg_tipo_incrementables_update
    BEFORE UPDATE ON public.tipo_incrementables
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 2) Registro del incrementable (la "OC del costo")
  pgm.createTable('incrementables_oc', {
    id: 'id',
    tipo_incrementable_id: {
      type: 'integer',
      notNull: true,
      references: 'tipo_incrementables(id)',
      onDelete: 'RESTRICT',
    },

    // OC que tiene el detalle del costo (ej. flete marítimo, impuestos, última milla, etc.)
    oc_incrementable_id: {
      type: 'integer',
      notNull: true,
      references: 'ordenes_compra(id)',
      onDelete: 'RESTRICT',
    },

    comentario: { type: 'text', notNull: false },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('incrementables_oc', 'tipo_incrementable_id');
  pgm.createIndex('incrementables_oc', 'oc_incrementable_id');

  pgm.sql(`
    CREATE TRIGGER trg_incrementables_oc_update
    BEFORE UPDATE ON public.incrementables_oc
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 3) Aplicaciones del incrementable a OC(s) base (muchos-a-muchos)
  pgm.createTable('incrementables_oc_aplicaciones', {
    id: 'id',
    incrementable_id: {
      type: 'integer',
      notNull: true,
      references: 'incrementables_oc(id)',
      onDelete: 'CASCADE',
    },

    oc_base_id: {
      type: 'integer',
      notNull: true,
      references: 'ordenes_compra(id)',
      onDelete: 'RESTRICT',
    },

    // Requisición origen de la OC base.
    // Si no se manda, se deriva de ordenes_compra.rfq_id por trigger.
    requisicion_base_id: {
      type: 'integer',
      notNull: false,
      references: 'requisiciones(id)',
      onDelete: 'SET NULL',
    },

    // Opcional (para futura distribución de costos / landed cost)
    monto_asignado: { type: 'numeric(14,4)', notNull: false },
    moneda: { type: 'bpchar(3)', notNull: false, references: 'catalogo_monedas(codigo)', onDelete: 'SET NULL' },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('incrementables_oc_aplicaciones', 'uq_incrementable_oc_base', {
    unique: ['incrementable_id', 'oc_base_id'],
  });

  pgm.createIndex('incrementables_oc_aplicaciones', 'oc_base_id');
  pgm.createIndex('incrementables_oc_aplicaciones', 'requisicion_base_id');

  pgm.sql(`
    CREATE TRIGGER trg_incrementables_oc_aplicaciones_update
    BEFORE UPDATE ON public.incrementables_oc_aplicaciones
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 4) Reglas de negocio:
  // - La OC base debe ser IMPO.
  // - requisicion_base_id: si no se manda, se deriva de ordenes_compra.rfq_id; si se manda, validamos que coincida.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.fn_incrementables_oc_aplicaciones_defaults()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_impo boolean;
      v_rfq_id integer;
    BEGIN
      SELECT oc.impo, oc.rfq_id INTO v_impo, v_rfq_id
      FROM public.ordenes_compra oc
      WHERE oc.id = NEW.oc_base_id;

      IF COALESCE(v_impo,false) IS NOT TRUE THEN
        RAISE EXCEPTION 'La OC base % no está marcada como IMPO; no se permite aplicar incrementables.', NEW.oc_base_id;
      END IF;

      IF NEW.requisicion_base_id IS NULL THEN
        NEW.requisicion_base_id := v_rfq_id;
      ELSE
        IF v_rfq_id IS NOT NULL AND NEW.requisicion_base_id <> v_rfq_id THEN
          RAISE EXCEPTION 'requisicion_base_id (%) no coincide con ordenes_compra.rfq_id (%) para OC %',
            NEW.requisicion_base_id, v_rfq_id, NEW.oc_base_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_incrementables_oc_aplicaciones_defaults
    BEFORE INSERT OR UPDATE OF oc_base_id, requisicion_base_id
    ON public.incrementables_oc_aplicaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_incrementables_oc_aplicaciones_defaults();
  `);

  // Permisos
  pgm.sql(grant_block({ tables: ["tipo_incrementables","incrementables_oc","incrementables_oc_aplicaciones"], sequences: ["tipo_incrementables_id_seq","incrementables_oc_id_seq","incrementables_oc_aplicaciones_id_seq"] }));
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_incrementables_oc_aplicaciones_defaults ON public.incrementables_oc_aplicaciones;
    DROP FUNCTION IF EXISTS public.fn_incrementables_oc_aplicaciones_defaults();
  `);

  pgm.sql(`DROP TRIGGER IF EXISTS trg_incrementables_oc_aplicaciones_update ON public.incrementables_oc_aplicaciones;`);
  pgm.dropTable('incrementables_oc_aplicaciones');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_incrementables_oc_update ON public.incrementables_oc;`);
  pgm.dropTable('incrementables_oc');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_tipo_incrementables_update ON public.tipo_incrementables;`);
  pgm.dropTable('tipo_incrementables');
};
