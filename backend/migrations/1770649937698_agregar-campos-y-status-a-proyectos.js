/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
// backend/migrations/XXXXXXXXXXXXXX_agregar_campos_y_status_a_proyectos.js

exports.up = (pgm) => {
  // 1) ENUM proyecto_status (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proyecto_status') THEN
        CREATE TYPE public.proyecto_status AS ENUM (
          'POR_APROBAR',
          'EN_EJECUCION',
          'EN_PAUSA',
          'CANCELADO',
          'CERRADO'
        );
      END IF;
    END $$;
  `);

  // 2) Columnas nuevas (idempotente)
  pgm.sql(`
    ALTER TABLE public.proyectos
      ADD COLUMN IF NOT EXISTS status public.proyecto_status NOT NULL DEFAULT 'POR_APROBAR',
      ADD COLUMN IF NOT EXISTS total_facturado numeric(14,4) NULL,
      ADD COLUMN IF NOT EXISTS total_facturado_moneda bpchar(3) NULL,
      ADD COLUMN IF NOT EXISTS costo_total numeric(14,4) NULL,
      ADD COLUMN IF NOT EXISTS costo_total_moneda bpchar(3) NULL,
      ADD COLUMN IF NOT EXISTS margen_estimado numeric(14,4) NULL,
      ADD COLUMN IF NOT EXISTS margen_moneda bpchar(3) NULL,
      ADD COLUMN IF NOT EXISTS margen_es_forzado bool NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS fecha_inicio date NULL,
      ADD COLUMN IF NOT EXISTS fecha_cierre date NULL;
  `);

  // 3) FKs a catálogo de monedas (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_total_facturado_moneda_fkey') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT proyectos_total_facturado_moneda_fkey
          FOREIGN KEY (total_facturado_moneda)
          REFERENCES public.catalogo_monedas(codigo)
          ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_costo_total_moneda_fkey') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT proyectos_costo_total_moneda_fkey
          FOREIGN KEY (costo_total_moneda)
          REFERENCES public.catalogo_monedas(codigo)
          ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_margen_moneda_fkey') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT proyectos_margen_moneda_fkey
          FOREIGN KEY (margen_moneda)
          REFERENCES public.catalogo_monedas(codigo)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 4) Checks útiles (idempotente)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proyectos_total_facturado_nonneg') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT chk_proyectos_total_facturado_nonneg
          CHECK (total_facturado IS NULL OR total_facturado >= 0);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proyectos_costo_total_nonneg') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT chk_proyectos_costo_total_nonneg
          CHECK (costo_total IS NULL OR costo_total >= 0);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proyectos_margen_estimado_nonneg') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT chk_proyectos_margen_estimado_nonneg
          CHECK (margen_estimado IS NULL OR margen_estimado >= 0);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proyectos_fechas_orden') THEN
        ALTER TABLE public.proyectos
          ADD CONSTRAINT chk_proyectos_fechas_orden
          CHECK (fecha_inicio IS NULL OR fecha_cierre IS NULL OR fecha_cierre >= fecha_inicio);
      END IF;
    END $$;
  `);

  // 5) Index opcional por status
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_proyectos_status ON public.proyectos(status);`);
};

exports.down = (pgm) => {
  // Quitar constraints (si existen)
  pgm.sql(`
    ALTER TABLE public.proyectos
      DROP CONSTRAINT IF EXISTS proyectos_total_facturado_moneda_fkey,
      DROP CONSTRAINT IF EXISTS proyectos_costo_total_moneda_fkey,
      DROP CONSTRAINT IF EXISTS proyectos_margen_moneda_fkey,
      DROP CONSTRAINT IF EXISTS chk_proyectos_total_facturado_nonneg,
      DROP CONSTRAINT IF EXISTS chk_proyectos_costo_total_nonneg,
      DROP CONSTRAINT IF EXISTS chk_proyectos_margen_estimado_nonneg,
      DROP CONSTRAINT IF EXISTS chk_proyectos_fechas_orden;
  `);

  // Quitar index
  pgm.sql(`DROP INDEX IF EXISTS idx_proyectos_status;`);

  // Quitar columnas
  pgm.sql(`
    ALTER TABLE public.proyectos
      DROP COLUMN IF EXISTS fecha_cierre,
      DROP COLUMN IF EXISTS fecha_inicio,
      DROP COLUMN IF EXISTS margen_es_forzado,
      DROP COLUMN IF EXISTS margen_moneda,
      DROP COLUMN IF EXISTS margen_estimado,
      DROP COLUMN IF EXISTS costo_total_moneda,
      DROP COLUMN IF EXISTS costo_total,
      DROP COLUMN IF EXISTS total_facturado_moneda,
      DROP COLUMN IF EXISTS total_facturado,
      DROP COLUMN IF EXISTS status;
  `);

  // Quitar tipo ENUM (solo si existe y ya no tiene dependencias)
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proyecto_status') THEN
        DROP TYPE public.proyecto_status;
      END IF;
    END $$;
  `);
};
