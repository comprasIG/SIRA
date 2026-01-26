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
     // 1) Columna de orden compartido por RFQ
  pgm.sql(`
    ALTER TABLE public.requisiciones_detalle
      ADD COLUMN IF NOT EXISTS rfq_sort_index integer;
  `);

  // Backfill inicial: respeta el orden actual (por nombre de material como hoy lo ordenas en el GET RFQ)
  // Si ya existe rfq_sort_index en algunas filas, NO lo pisa.
  pgm.sql(`
    WITH ranked AS (
      SELECT
        rd.id AS requisicion_detalle_id,
        ROW_NUMBER() OVER (
          PARTITION BY rd.requisicion_id
          ORDER BY cm.nombre ASC, rd.id ASC
        ) AS rn
      FROM public.requisiciones_detalle rd
      JOIN public.catalogo_materiales cm ON cm.id = rd.material_id
      WHERE rd.rfq_sort_index IS NULL
    )
    UPDATE public.requisiciones_detalle rd
    SET rfq_sort_index = ranked.rn
    FROM ranked
    WHERE rd.id = ranked.requisicion_detalle_id;
  `);

  // Asegurar NOT NULL + DEFAULT (después del backfill)
  pgm.sql(`
    ALTER TABLE public.requisiciones_detalle
      ALTER COLUMN rfq_sort_index SET DEFAULT 0;
  `);

  // Nota: poner NOT NULL puede fallar si hay filas raras sin material_id; por seguridad lo hacemos en 2 pasos:
  pgm.sql(`
    UPDATE public.requisiciones_detalle
    SET rfq_sort_index = 0
    WHERE rfq_sort_index IS NULL;
  `);

  pgm.sql(`
    ALTER TABLE public.requisiciones_detalle
      ALTER COLUMN rfq_sort_index SET NOT NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_requisiciones_detalle_rfq_sort
    ON public.requisiciones_detalle (requisicion_id, rfq_sort_index);
  `);

  // 2) Tabla preferencias UI por usuario (persistente en BD)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.usuarios_ui_preferencias (
      usuario_id int4 PRIMARY KEY
        REFERENCES public.usuarios(id) ON DELETE CASCADE,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_usuarios_ui_preferencias_actualizado_en
    ON public.usuarios_ui_preferencias (actualizado_en DESC);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
      // Revertir tabla de preferencias
  pgm.sql(`
    DROP TABLE IF EXISTS public.usuarios_ui_preferencias;
  `);

  // Revertir índice y columna de orden
  pgm.sql(`
    DROP INDEX IF EXISTS public.idx_requisiciones_detalle_rfq_sort;
  `);

  pgm.sql(`
    ALTER TABLE public.requisiciones_detalle
      DROP COLUMN IF EXISTS rfq_sort_index;
  `);
};
