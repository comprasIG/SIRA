/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
// backend/migrations/XXXXXXXXXXXXXX_crear_tabla_proyectos_hitos.js

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.proyectos_hitos (
      id serial4 NOT NULL,
      proyecto_id int4 NOT NULL,
      nombre varchar(150) NOT NULL,
      descripcion text NULL,
      target_date date NULL,
      fecha_realizacion date NULL,
      creado_en timestamptz DEFAULT now() NOT NULL,
      actualizado_en timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT proyectos_hitos_pkey PRIMARY KEY (id),
      CONSTRAINT proyectos_hitos_proyecto_id_fkey
        FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id)
        ON DELETE CASCADE
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_proyectos_hitos_proyecto_id ON public.proyectos_hitos(proyecto_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_proyectos_hitos_target_date ON public.proyectos_hitos(target_date);`);

  // Trigger update_timestamp() (no existe IF NOT EXISTS para triggers -> usamos DO)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proyectos_hitos_update') THEN
        CREATE TRIGGER trg_proyectos_hitos_update
        BEFORE UPDATE ON public.proyectos_hitos
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
      END IF;
    END $$;
  `);

  // Grants (repetibles sin problema)
  pgm.sql(`
    GRANT ALL ON TABLE public.proyectos_hitos TO postgres;
    GRANT ALL ON TABLE public.proyectos_hitos TO sira_stg_user;
    GRANT INSERT, UPDATE, SELECT, DELETE ON TABLE public.proyectos_hitos TO sira_prod_user;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS public.proyectos_hitos;`);
};
