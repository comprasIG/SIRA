/**
 * Permite margen_estimado negativo en proyectos.
 * Se elimina el check que forzaba margen_estimado >= 0.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.proyectos
    DROP CONSTRAINT IF EXISTS chk_proyectos_margen_estimado_nonneg;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proyectos_margen_estimado_nonneg') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT chk_proyectos_margen_estimado_nonneg
          CHECK (margen_estimado IS NULL OR margen_estimado >= 0);
      END IF;
    END $$;
  `);
};

