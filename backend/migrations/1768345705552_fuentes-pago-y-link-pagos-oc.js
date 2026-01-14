/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

exports.up = async (pgm) => {
  // 1) Catálogo de fuentes (si no existe)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.catalogo_fuentes_pago (
      id serial4 PRIMARY KEY,
      nombre text NOT NULL UNIQUE,
      tipo text NOT NULL CHECK (tipo IN ('BANCO','EFECTIVO','TARJETA','OTRO')),
      activo boolean NOT NULL DEFAULT true,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Seed base: NO ESPECIFICADO (si no existe)
  pgm.sql(`
    INSERT INTO public.catalogo_fuentes_pago (nombre, tipo, activo)
    VALUES ('NO ESPECIFICADO', 'OTRO', true)
    ON CONFLICT (nombre) DO NOTHING;
  `);

  // 2) Agregar columna a pagos_oc (si no existe)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='pagos_oc' AND column_name='fuente_pago_id'
      ) THEN
        ALTER TABLE public.pagos_oc
        ADD COLUMN fuente_pago_id int4 NULL;
      END IF;
    END$$;
  `);

  // 3) Backfill de pagos existentes -> NO ESPECIFICADO
  pgm.sql(`
    UPDATE public.pagos_oc
    SET fuente_pago_id = (SELECT id FROM public.catalogo_fuentes_pago WHERE nombre='NO ESPECIFICADO' LIMIT 1)
    WHERE fuente_pago_id IS NULL;
  `);

  // 4) Forzar NOT NULL + FK (si no existen)
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    ALTER COLUMN fuente_pago_id SET NOT NULL;
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pagos_oc_fuente_pago_id_fkey'
      ) THEN
        ALTER TABLE public.pagos_oc
        ADD CONSTRAINT pagos_oc_fuente_pago_id_fkey
        FOREIGN KEY (fuente_pago_id)
        REFERENCES public.catalogo_fuentes_pago(id)
        ON DELETE RESTRICT;
      END IF;
    END$$;
  `);

  // Índice útil
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pagos_oc_fuente_pago_id
    ON public.pagos_oc (fuente_pago_id);
  `);
};

exports.down = async (pgm) => {
  // Down conservador (evitamos borrar datos si ya está en uso).
  // Si quieres un down destructivo, lo armamos, pero no lo recomiendo en producción.
  pgm.sql(`-- no-op`);
};
