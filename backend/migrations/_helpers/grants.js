/**
 * Helper para grants “env-aware” (misma instancia, 2 DBs):
 * - ig_biogas_core  => sira_stg_user
 * - sira_prod       => sira_prod_user
 *
 * Se usa desde migraciones con:
 *   const { grant_block } = require('./_helpers/grants');
 *   pgm.sql(grant_block({ tables:[...], sequences:[...] }));
 */

const DB_ROLE_MAP = {
  ig_biogas_core: 'sira_stg_user',
  sira_prod: 'sira_prod_user',
};

function sqlTextArray(items = []) {
  if (!items.length) return "ARRAY[]::text[]";
  const escaped = items.map((x) => String(x).replace(/'/g, "''"));
  return `ARRAY['${escaped.join("','")}']::text[]`;
}

function grant_block({ schema = 'public', tables = [], sequences = [] } = {}) {
  return `
    DO $$
    DECLARE
      db text := current_database();
      app_role text;
      schema_name text := '${schema}';
      obj text;
    BEGIN
      app_role := CASE db
        WHEN 'ig_biogas_core' THEN '${DB_ROLE_MAP.ig_biogas_core}'
        WHEN 'sira_prod' THEN '${DB_ROLE_MAP.sira_prod}'
        ELSE NULL
      END;

      IF app_role IS NULL THEN
        RAISE NOTICE 'grant_block: DB % no está mapeada; no se aplican grants.', db;
        RETURN;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
        RAISE NOTICE 'grant_block: rol % no existe; no se aplican grants.', app_role;
        RETURN;
      END IF;

      -- Schema usage
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, app_role);

      -- Tablas
      FOREACH obj IN ARRAY ${sqlTextArray(tables)} LOOP
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I',
          schema_name, obj, app_role
        );
      END LOOP;

      -- Secuencias
      FOREACH obj IN ARRAY ${sqlTextArray(sequences)} LOOP
        EXECUTE format(
          'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO %I',
          schema_name, obj, app_role
        );
      END LOOP;
    END $$;
  `;
}

module.exports = { grant_block };