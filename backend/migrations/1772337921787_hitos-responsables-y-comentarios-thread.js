/**
 * Migración: Hitos de Proyecto
 * 1) Multi-responsables por hito (tabla puente)
 * 2) Comentarios con thread (parent_id) + status (PENDIENTE/RESUELTO)
 *
 * ✅ Decisiones:
 * - Normalizamos public.proyectos_hitos.id a int4 si en algún entorno estuviera varchar/text.
 *   - Si el cast falla (IDs no numéricos), se hace remap con nuevos IDs (OK porque hitos son datos de prueba).
 * - Responsables: tabla puente (N responsables). Sin límite.
 * - Drop inmediato de proyectos_hitos.responsable_id.
 * - Comentarios: thread con parent_id (ON DELETE SET NULL).
 * - Comentarios.usuario_id: ON DELETE SET NULL (conserva comentario si se borra usuario).
 * - Responsables.usuario_id: ON DELETE CASCADE (limpia asignación si se borra usuario).
 * - Status: ENUM (PENDIENTE/RESUELTO).
 * - id comentarios: bigserial.
 */
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const SCHEMA = 'public';

const TABLE_HITOS = 'proyectos_hitos';
const TABLE_USUARIOS = 'usuarios';

const TABLE_RESP = 'proyectos_hitos_responsables';
const TABLE_COMENTS = 'proyectos_hitos_comentarios';
const TYPE_COMENT_STATUS = 'proyectos_hito_comentario_status';


/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  /**
   * 0) NORMALIZACIÓN: asegurar que public.proyectos_hitos.id sea int4 en todos los entornos
   *    (si está varchar/text, convertimos; si no se puede castear, remapeamos IDs).
   */
  pgm.sql(`
    DO $$
    DECLARE
      v_udt text;
      v_max bigint;
      v_seq_exists boolean;
    BEGIN
      SELECT c.udt_name
      INTO v_udt
      FROM information_schema.columns c
      WHERE c.table_schema = '${SCHEMA}'
        AND c.table_name = '${TABLE_HITOS}'
        AND c.column_name = 'id'
      LIMIT 1;

      IF v_udt IS NULL THEN
        RAISE EXCEPTION 'No existe %.%.id', '${SCHEMA}', '${TABLE_HITOS}';
      END IF;

      -- Asegurar que exista la sequence (por si algún entorno raro no la tiene)
      SELECT EXISTS (
        SELECT 1
        FROM pg_class cl
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE cl.relkind = 'S'
          AND ns.nspname = '${SCHEMA}'
          AND cl.relname = '${TABLE_HITOS}_id_seq'
      ) INTO v_seq_exists;

      IF NOT v_seq_exists THEN
        EXECUTE 'CREATE SEQUENCE ${SCHEMA}.${TABLE_HITOS}_id_seq';
      END IF;

      -- Si NO es int4, normalizamos a int4
      IF v_udt <> 'int4' THEN
        -- Quitamos default temporalmente
        EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} ALTER COLUMN id DROP DEFAULT';

        BEGIN
          -- Intento 1: cast directo (si el varchar trae números)
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} ALTER COLUMN id TYPE int4 USING id::int4';
        EXCEPTION WHEN others THEN
          -- Fallback: remap (IDs de prueba → OK)
          -- Creamos columna temporal int4 y asignamos nuevos IDs
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} ADD COLUMN id_int int4';
          EXECUTE 'UPDATE ${SCHEMA}.${TABLE_HITOS} SET id_int = nextval(''${SCHEMA}.${TABLE_HITOS}_id_seq''::regclass)';

          -- Reemplazamos PK/columna id
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} DROP CONSTRAINT IF EXISTS ${TABLE_HITOS}_pkey';
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} DROP COLUMN id';
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} RENAME COLUMN id_int TO id';
          EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} ADD CONSTRAINT ${TABLE_HITOS}_pkey PRIMARY KEY (id)';
        END;

        -- Restaurar default y ownership de la sequence
        EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} ALTER COLUMN id SET DEFAULT nextval(''${SCHEMA}.${TABLE_HITOS}_id_seq''::regclass)';
        EXECUTE 'ALTER SEQUENCE ${SCHEMA}.${TABLE_HITOS}_id_seq OWNED BY ${SCHEMA}.${TABLE_HITOS}.id';
      END IF;

      -- Ajustar la sequence al MAX(id) para evitar colisiones
      SELECT COALESCE(MAX(id), 0) INTO v_max FROM ${SCHEMA}.${TABLE_HITOS};
      PERFORM setval('${SCHEMA}.${TABLE_HITOS}_id_seq', v_max + 1, false);
    END $$;
  `);

  /**
   * 1) Tabla puente: responsables (hito_id int4)
   */
  pgm.sql(`
    CREATE TABLE ${SCHEMA}.${TABLE_RESP} (
      hito_id int4 NOT NULL,
      usuario_id int4 NOT NULL,
      creado_en timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT ${TABLE_RESP}_pkey PRIMARY KEY (hito_id, usuario_id),
      CONSTRAINT ${TABLE_RESP}_hito_id_fkey
        FOREIGN KEY (hito_id) REFERENCES ${SCHEMA}.${TABLE_HITOS}(id) ON DELETE CASCADE,
      CONSTRAINT ${TABLE_RESP}_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES ${SCHEMA}.${TABLE_USUARIOS}(id) ON DELETE CASCADE
    );
  `);

  pgm.sql(`
    CREATE INDEX idx_${TABLE_RESP}_usuario_id
    ON ${SCHEMA}.${TABLE_RESP} USING btree (usuario_id);
  `);

  /**
   * 1.1) Backfill desde responsable_id (si existe) + drop legacy
   */
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='${SCHEMA}'
          AND table_name='${TABLE_HITOS}'
          AND column_name='responsable_id'
      ) THEN
        EXECUTE $SQL$
          INSERT INTO ${SCHEMA}.${TABLE_RESP} (hito_id, usuario_id)
          SELECT id, responsable_id
          FROM ${SCHEMA}.${TABLE_HITOS}
          WHERE responsable_id IS NOT NULL
          ON CONFLICT DO NOTHING
        $SQL$;

        EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} DROP CONSTRAINT IF EXISTS proyectos_hitos_responsable_id_fkey';
        EXECUTE 'DROP INDEX IF EXISTS ${SCHEMA}.idx_proyectos_hitos_responsable_id';
        EXECUTE 'ALTER TABLE ${SCHEMA}.${TABLE_HITOS} DROP COLUMN IF EXISTS responsable_id';
      END IF;
    END $$;
  `);

  /**
   * 2) ENUM status comentarios
   */
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = '${TYPE_COMENT_STATUS}'
          AND n.nspname = '${SCHEMA}'
      ) THEN
        CREATE TYPE ${SCHEMA}.${TYPE_COMENT_STATUS} AS ENUM ('PENDIENTE', 'RESUELTO');
      END IF;
    END $$;
  `);

  pgm.sql(`GRANT USAGE ON TYPE ${SCHEMA}.${TYPE_COMENT_STATUS} TO sira_prod_user;`);
  pgm.sql(`GRANT USAGE ON TYPE ${SCHEMA}.${TYPE_COMENT_STATUS} TO sira_stg_user;`);

  /**
   * 3) Tabla comentarios con thread (hito_id int4)
   */
  pgm.sql(`
    CREATE TABLE ${SCHEMA}.${TABLE_COMENTS} (
      id bigserial NOT NULL,
      hito_id int4 NOT NULL,
      usuario_id int4 NULL,
      parent_id bigint NULL,
      comentario text NOT NULL,
      status ${SCHEMA}.${TYPE_COMENT_STATUS} DEFAULT 'PENDIENTE' NOT NULL,
      creado_en timestamptz DEFAULT now() NOT NULL,
      actualizado_en timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT ${TABLE_COMENTS}_pkey PRIMARY KEY (id),
      CONSTRAINT ${TABLE_COMENTS}_hito_id_fkey
        FOREIGN KEY (hito_id) REFERENCES ${SCHEMA}.${TABLE_HITOS}(id) ON DELETE CASCADE,
      CONSTRAINT ${TABLE_COMENTS}_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES ${SCHEMA}.${TABLE_USUARIOS}(id) ON DELETE SET NULL,
      CONSTRAINT ${TABLE_COMENTS}_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES ${SCHEMA}.${TABLE_COMENTS}(id) ON DELETE SET NULL
    );
  `);

  pgm.sql(`
    CREATE INDEX idx_${TABLE_COMENTS}_hito_id_creado_en
    ON ${SCHEMA}.${TABLE_COMENTS} USING btree (hito_id, creado_en);
  `);

  pgm.sql(`
    CREATE INDEX idx_${TABLE_COMENTS}_parent_id
    ON ${SCHEMA}.${TABLE_COMENTS} USING btree (parent_id);
  `);

  pgm.sql(`
    CREATE INDEX idx_${TABLE_COMENTS}_hito_id_status
    ON ${SCHEMA}.${TABLE_COMENTS} USING btree (hito_id, status);
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_${TABLE_COMENTS}_update ON ${SCHEMA}.${TABLE_COMENTS};
  `);

  pgm.sql(`
    CREATE TRIGGER trg_${TABLE_COMENTS}_update
    BEFORE UPDATE ON ${SCHEMA}.${TABLE_COMENTS}
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  `);

  /**
   * 4) Permisos
   */
  pgm.sql(`GRANT ALL ON TABLE ${SCHEMA}.${TABLE_RESP} TO postgres;`);
  pgm.sql(`GRANT ALL ON TABLE ${SCHEMA}.${TABLE_RESP} TO sira_stg_user;`);
  pgm.sql(`GRANT INSERT, DELETE, SELECT, UPDATE ON TABLE ${SCHEMA}.${TABLE_RESP} TO sira_prod_user;`);

  pgm.sql(`GRANT ALL ON TABLE ${SCHEMA}.${TABLE_COMENTS} TO postgres;`);
  pgm.sql(`GRANT ALL ON TABLE ${SCHEMA}.${TABLE_COMENTS} TO sira_stg_user;`);
  pgm.sql(`GRANT INSERT, DELETE, SELECT, UPDATE ON TABLE ${SCHEMA}.${TABLE_COMENTS} TO sira_prod_user;`);

  pgm.sql(`GRANT USAGE, SELECT, UPDATE ON SEQUENCE ${SCHEMA}.${TABLE_COMENTS}_id_seq TO sira_prod_user;`);
  pgm.sql(`GRANT USAGE, SELECT, UPDATE ON SEQUENCE ${SCHEMA}.${TABLE_COMENTS}_id_seq TO sira_stg_user;`);


};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {

  /**
    * Nota: Como esta migración NORMALIZA el tipo de proyectos_hitos.id a int4,
    * el DOWN no intenta volverlo a varchar (porque no podemos saber el tipo “original” por entorno).
    * Sí revierte: columna responsable_id, tablas nuevas y enum.
    */

  // Restaurar responsable_id
  pgm.sql(`
    ALTER TABLE ${SCHEMA}.${TABLE_HITOS}
    ADD COLUMN IF NOT EXISTS responsable_id int4 NULL;
  `);

  pgm.sql(`
    ALTER TABLE ${SCHEMA}.${TABLE_HITOS}
    DROP CONSTRAINT IF EXISTS proyectos_hitos_responsable_id_fkey;
  `);

  pgm.sql(`
    ALTER TABLE ${SCHEMA}.${TABLE_HITOS}
    ADD CONSTRAINT proyectos_hitos_responsable_id_fkey
    FOREIGN KEY (responsable_id) REFERENCES ${SCHEMA}.${TABLE_USUARIOS}(id) ON DELETE SET NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_proyectos_hitos_responsable_id
    ON ${SCHEMA}.${TABLE_HITOS} USING btree (responsable_id);
  `);

  // Backfill “principal” desde tabla puente
  pgm.sql(`
    UPDATE ${SCHEMA}.${TABLE_HITOS} h
    SET responsable_id = x.usuario_id
    FROM (
      SELECT hito_id, MIN(usuario_id) AS usuario_id
      FROM ${SCHEMA}.${TABLE_RESP}
      GROUP BY hito_id
    ) x
    WHERE h.id = x.hito_id;
  `);

  // Dropear comentarios
  pgm.sql(`DROP TRIGGER IF EXISTS trg_${TABLE_COMENTS}_update ON ${SCHEMA}.${TABLE_COMENTS};`);
  pgm.sql(`DROP TABLE IF EXISTS ${SCHEMA}.${TABLE_COMENTS} CASCADE;`);

  // Dropear enum
  pgm.sql(`DROP TYPE IF EXISTS ${SCHEMA}.${TYPE_COMENT_STATUS};`);

  // Dropear responsables
  pgm.sql(`DROP TABLE IF EXISTS ${SCHEMA}.${TABLE_RESP} CASCADE;`);


};
