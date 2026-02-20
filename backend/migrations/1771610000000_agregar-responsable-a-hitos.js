/**
 * Migración idempotente: agrega columna responsable_id a proyectos_hitos.
 * El responsable del hito determina qué departamento es responsable
 * de completarlo (se deriva de usuarios.departamento_id).
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1) Agregar columna responsable_id (nullable, FK → usuarios ON DELETE SET NULL)
  pgm.sql(`
    ALTER TABLE public.proyectos_hitos
      ADD COLUMN IF NOT EXISTS responsable_id int4 NULL
        REFERENCES public.usuarios(id) ON DELETE SET NULL;
  `);

  // 2) Índice para acelerar búsquedas por responsable
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_proyectos_hitos_responsable_id
      ON public.proyectos_hitos(responsable_id);
  `);

  // 3) Grants (idempotentes)
  pgm.sql(`
    GRANT ALL ON TABLE public.proyectos_hitos TO postgres;
    GRANT ALL ON TABLE public.proyectos_hitos TO sira_stg_user;
    GRANT INSERT, UPDATE, SELECT, DELETE ON TABLE public.proyectos_hitos TO sira_prod_user;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.proyectos_hitos DROP COLUMN IF EXISTS responsable_id;
  `);
  pgm.sql(`
    DROP INDEX IF EXISTS idx_proyectos_hitos_responsable_id;
  `);
};