/**
 * Objetivo (Prompt #4 y #6):
 * - Crear catálogo de Incoterms.
 * - Crear tabla de preferencias de importación por OC marcada como IMPO:
 *   qué imprimir en PDF (sitio/proyecto), dirección de entrega (desde sitios) e incoterm.
 */

exports.shorthands = undefined;


const { grant_block } = require('./_helpers/grants');
exports.up = (pgm) => {
  // 1) Catálogo de Incoterms (Logística)
  pgm.createTable('catalogo_incoterms', {
    id: 'id',
    incoterm: { type: 'varchar(100)', notNull: true },
    abreviatura: { type: 'varchar(20)', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('catalogo_incoterms', 'uq_catalogo_incoterms_abreviatura', { unique: ['abreviatura'] });

  pgm.createIndex('catalogo_incoterms', 'abreviatura');

  pgm.sql(`
    CREATE TRIGGER trg_catalogo_incoterms_update
    BEFORE UPDATE ON public.catalogo_incoterms
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 2) Preferencias por OC de importación
  pgm.createTable('oc_preferencias_importacion', {
    orden_compra_id: {
      type: 'integer',
      notNull: true,
      primaryKey: true,
      references: 'ordenes_compra(id)',
      onDelete: 'CASCADE',
    },

    imprimir_sitio: { type: 'boolean', notNull: true, default: true },
    imprimir_proyecto: { type: 'boolean', notNull: true, default: true },

    // Dirección de entrega seleccionada desde sitios (sitios.ubicacion)
    sitio_entrega_id: { type: 'integer', notNull: false, references: 'sitios(id)', onDelete: 'SET NULL' },
    imprimir_direccion_entrega: { type: 'boolean', notNull: true, default: true },

    // Incoterm asociado a la OC
    incoterm_id: { type: 'integer', notNull: false, references: 'catalogo_incoterms(id)', onDelete: 'SET NULL' },

    notas: { type: 'text', notNull: false },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('oc_preferencias_importacion', 'sitio_entrega_id');
  pgm.createIndex('oc_preferencias_importacion', 'incoterm_id');

  pgm.sql(`
    CREATE TRIGGER trg_oc_preferencias_importacion_update
    BEFORE UPDATE ON public.oc_preferencias_importacion
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 3) Regla de negocio: solo permitir preferencias si la OC está marcada como IMPO
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.fn_validar_oc_impo_preferencias()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_impo boolean;
    BEGIN
      SELECT oc.impo INTO v_impo
      FROM public.ordenes_compra oc
      WHERE oc.id = NEW.orden_compra_id;

      IF COALESCE(v_impo,false) IS NOT TRUE THEN
        RAISE EXCEPTION 'La OC % no está marcada como IMPO; no se pueden registrar preferencias de importación.', NEW.orden_compra_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_validar_oc_impo_preferencias
    BEFORE INSERT OR UPDATE OF orden_compra_id
    ON public.oc_preferencias_importacion
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validar_oc_impo_preferencias();
  `);

  // Permisos
  pgm.sql(grant_block({ tables: ["catalogo_incoterms","oc_preferencias_importacion"], sequences: ["catalogo_incoterms_id_seq"] }));
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_validar_oc_impo_preferencias ON public.oc_preferencias_importacion;
    DROP FUNCTION IF EXISTS public.fn_validar_oc_impo_preferencias();
  `);

  pgm.sql(`DROP TRIGGER IF EXISTS trg_oc_preferencias_importacion_update ON public.oc_preferencias_importacion;`);
  pgm.dropTable('oc_preferencias_importacion');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_catalogo_incoterms_update ON public.catalogo_incoterms;`);
  pgm.dropTable('catalogo_incoterms');
};
