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
 // 1) Columnas (idempotente)
  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      ADD COLUMN IF NOT EXISTS estado varchar(12) NOT NULL DEFAULT 'ACTIVO',
      ADD COLUMN IF NOT EXISTS anulado_en timestamptz NULL,
      ADD COLUMN IF NOT EXISTS anulado_por int4 NULL,
      ADD COLUMN IF NOT EXISTS motivo_anulacion text NULL,
      ADD COLUMN IF NOT EXISTS reversa_de_movimiento_id int4 NULL;
  `);

  // 2) CHECK de estado (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_estado_chk'
      ) THEN
        ALTER TABLE public.movimientos_inventario
          ADD CONSTRAINT movimientos_inventario_estado_chk
          CHECK (estado IN ('ACTIVO', 'ANULADO'));
      END IF;
    END $$;
  `);

  // 3) FK anulado_por -> usuarios(id) (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mov_inv_anulado_por_fkey'
      ) THEN
        ALTER TABLE public.movimientos_inventario
          ADD CONSTRAINT mov_inv_anulado_por_fkey
          FOREIGN KEY (anulado_por) REFERENCES public.usuarios(id)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 4) FK reversa_de_movimiento_id -> movimientos_inventario(id) (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mov_inv_reversa_de_fkey'
      ) THEN
        ALTER TABLE public.movimientos_inventario
          ADD CONSTRAINT mov_inv_reversa_de_fkey
          FOREIGN KEY (reversa_de_movimiento_id) REFERENCES public.movimientos_inventario(id)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    
  // Constraints (si existen)
  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      DROP CONSTRAINT IF EXISTS mov_inv_reversa_de_fkey,
      DROP CONSTRAINT IF EXISTS mov_inv_anulado_por_fkey,
      DROP CONSTRAINT IF EXISTS movimientos_inventario_estado_chk;
  `);

  // Columnas (si existen)
  pgm.sql(`
    ALTER TABLE public.movimientos_inventario
      DROP COLUMN IF EXISTS reversa_de_movimiento_id,
      DROP COLUMN IF EXISTS motivo_anulacion,
      DROP COLUMN IF EXISTS anulado_por,
      DROP COLUMN IF EXISTS anulado_en,
      DROP COLUMN IF EXISTS estado;
  `);
};
