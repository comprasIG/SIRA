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
      // 1) Columna
  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      ADD COLUMN IF NOT EXISTS asignacion_origen_id int4 NULL;
  `);

  // 2) FK (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mov_inv_asignacion_origen_fkey'
      ) THEN
        ALTER TABLE public.movimientos_inventario
          ADD CONSTRAINT mov_inv_asignacion_origen_fkey
          FOREIGN KEY (asignacion_origen_id)
          REFERENCES public.inventario_asignado(id)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 3) Index (NO concurrently para evitar el error de transaction)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_mov_inv_asignacion_origen_id
      ON public.movimientos_inventario (asignacion_origen_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     // Down idempotente
  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      DROP CONSTRAINT IF EXISTS mov_inv_asignacion_origen_fkey;
  `);

  pgm.sql(`
    DROP INDEX IF EXISTS public.idx_mov_inv_asignacion_origen_id;
  `);

  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      DROP COLUMN IF EXISTS asignacion_origen_id;
  `);
};
