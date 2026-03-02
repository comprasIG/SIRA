/**
 * Objetivo (Prompt #5):
 * - Crear catálogo de ensambles.
 * - Separar en tablas: ensamble (cabecera) + modelos 3D versionados + lista de materiales (BOM).
 *
 * Decisión de diseño:
 * - Separamos "modelos 3D" y "materiales" para mantener normalización y permitir N versiones + N materiales.
 */

exports.shorthands = undefined;


const { grant_block } = require('./_helpers/grants');
exports.up = (pgm) => {
  // 1) Cabecera
  pgm.createTable('catalogo_ensambles', {
    id: 'id',
    nombre: { type: 'varchar(150)', notNull: true },
    descripcion: { type: 'text', notNull: false },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('catalogo_ensambles', 'uq_catalogo_ensambles_nombre', { unique: ['nombre'] });

  pgm.sql(`
    CREATE TRIGGER trg_catalogo_ensambles_update
    BEFORE UPDATE ON public.catalogo_ensambles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 2) Modelos 3D versionados
  pgm.createTable('catalogo_ensambles_modelos', {
    id: 'id',
    ensamble_id: { type: 'integer', notNull: true, references: 'catalogo_ensambles(id)', onDelete: 'CASCADE' },
    version: { type: 'varchar(50)', notNull: true }, // ej: v1, v2, 2026-03-01, etc.
    modelo_url: { type: 'text', notNull: true }, // link a Google Cloud Storage
    es_actual: { type: 'boolean', notNull: true, default: false },
    comentario: { type: 'text', notNull: false },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('catalogo_ensambles_modelos', 'uq_ensamble_modelo_version', {
    unique: ['ensamble_id', 'version'],
  });

  // Solo 1 modelo "actual" por ensamble (índice parcial)
  pgm.sql(`
    CREATE UNIQUE INDEX uq_ensamble_modelo_actual
    ON public.catalogo_ensambles_modelos (ensamble_id)
    WHERE es_actual = true;
  `);

  pgm.createIndex('catalogo_ensambles_modelos', 'ensamble_id');

  pgm.sql(`
    CREATE TRIGGER trg_catalogo_ensambles_modelos_update
    BEFORE UPDATE ON public.catalogo_ensambles_modelos
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // Regla: si una versión se marca como actual, desmarcar las demás
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.fn_ensamble_modelo_set_unico_actual()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.es_actual IS TRUE THEN
        UPDATE public.catalogo_ensambles_modelos
        SET es_actual = false, actualizado_en = now()
        WHERE ensamble_id = NEW.ensamble_id
          AND id <> NEW.id
          AND es_actual IS TRUE;
      END IF;
      RETURN NULL;
    END;
    $$;

    CREATE TRIGGER trg_ensamble_modelo_set_unico_actual
    AFTER INSERT OR UPDATE OF es_actual
    ON public.catalogo_ensambles_modelos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ensamble_modelo_set_unico_actual();
  `);

  // 3) Lista de materiales (BOM)
  pgm.createTable('catalogo_ensambles_materiales', {
    id: 'id',
    ensamble_id: { type: 'integer', notNull: true, references: 'catalogo_ensambles(id)', onDelete: 'CASCADE' },
    material_id: { type: 'integer', notNull: true, references: 'catalogo_materiales(id)', onDelete: 'RESTRICT' },
    cantidad: { type: 'numeric(12,4)', notNull: true },
    unidad_id: { type: 'integer', notNull: true, references: 'catalogo_unidades(id)', onDelete: 'RESTRICT' },
    comentario: { type: 'text', notNull: false },
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('catalogo_ensambles_materiales', 'chk_ensamble_material_cantidad_pos', { check: 'cantidad > 0' });
  pgm.addConstraint('catalogo_ensambles_materiales', 'uq_ensamble_material_unico', {
    unique: ['ensamble_id', 'material_id'],
  });

  pgm.createIndex('catalogo_ensambles_materiales', 'ensamble_id');
  pgm.createIndex('catalogo_ensambles_materiales', 'material_id');

  pgm.sql(`
    CREATE TRIGGER trg_catalogo_ensambles_materiales_update
    BEFORE UPDATE ON public.catalogo_ensambles_materiales
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // Permisos
  pgm.sql(grant_block({ tables: ["catalogo_ensambles","catalogo_ensambles_modelos","catalogo_ensambles_materiales"], sequences: ["catalogo_ensambles_id_seq","catalogo_ensambles_modelos_id_seq","catalogo_ensambles_materiales_id_seq"] }));
};

exports.down = (pgm) => {
  // Triggers/functions primero
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_ensamble_modelo_set_unico_actual ON public.catalogo_ensambles_modelos;
    DROP FUNCTION IF EXISTS public.fn_ensamble_modelo_set_unico_actual();
  `);

  pgm.sql(`DROP TRIGGER IF EXISTS trg_catalogo_ensambles_materiales_update ON public.catalogo_ensambles_materiales;`);
  pgm.dropTable('catalogo_ensambles_materiales');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_catalogo_ensambles_modelos_update ON public.catalogo_ensambles_modelos;`);
  pgm.sql(`DROP INDEX IF EXISTS public.uq_ensamble_modelo_actual;`);
  pgm.dropTable('catalogo_ensambles_modelos');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_catalogo_ensambles_update ON public.catalogo_ensambles;`);
  pgm.dropTable('catalogo_ensambles');
};
