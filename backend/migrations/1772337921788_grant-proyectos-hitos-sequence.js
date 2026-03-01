/**
 * Hardening de privilegios para usuarios de app:
 * - Corrige permisos faltantes en secuencias (caso proyectos_hitos_id_seq).
 * - Da permisos sobre objetos existentes en schema public.
 * - Configura ALTER DEFAULT PRIVILEGES para objetos futuros.
 *
 * Nota: ALTER DEFAULT PRIVILEGES es por "rol creador". Por eso se intenta
 * aplicar para postgres, sira_prod_user y sira_stg_user.
 */
exports.shorthands = undefined;

const SCHEMA = 'public';
const SEQ = 'proyectos_hitos_id_seq';
const APP_ROLES = ['sira_prod_user', 'sira_stg_user'];
const OWNER_ROLES = ['postgres', 'sira_prod_user', 'sira_stg_user'];

exports.up = (pgm) => {
  // 1) Baseline: grants sobre objetos existentes
  pgm.sql(`
    DO $$
    DECLARE
      role_name text;
    BEGIN
      FOREACH role_name IN ARRAY ARRAY['${APP_ROLES.join("','")}'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
          EXECUTE format('GRANT USAGE ON SCHEMA ${SCHEMA} TO %I', role_name);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SCHEMA} TO %I', role_name);
          EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${SCHEMA} TO %I', role_name);
          EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO %I', role_name);
        END IF;
      END LOOP;
    END $$;
  `);

  // 2) Default privileges: objetos futuros creados por roles owner conocidos
  pgm.sql(`
    DO $$
    DECLARE
      owner_role text;
      app_role text;
    BEGIN
      FOREACH owner_role IN ARRAY ARRAY['${OWNER_ROLES.join("','")}'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
          FOREACH app_role IN ARRAY ARRAY['${APP_ROLES.join("','")}'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
              BEGIN
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
                  owner_role, app_role
                );
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
                  owner_role, app_role
                );
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} GRANT EXECUTE ON FUNCTIONS TO %I',
                  owner_role, app_role
                );
              EXCEPTION
                WHEN insufficient_privilege THEN
                  RAISE NOTICE 'Sin privilegio para ALTER DEFAULT PRIVILEGES FOR ROLE %', owner_role;
              END;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END $$;
  `);

  // 3) Fix explícito del caso reportado: proyectos_hitos_id_seq
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('${SCHEMA}.${SEQ}') IS NULL THEN
        RAISE NOTICE 'Secuencia %.% no existe; se omite ajuste puntual.', '${SCHEMA}', '${SEQ}';
      ELSE
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sira_prod_user') THEN
          EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ${SCHEMA}.${SEQ} TO sira_prod_user';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sira_stg_user') THEN
          EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ${SCHEMA}.${SEQ} TO sira_stg_user';
        END IF;

        IF to_regclass('${SCHEMA}.proyectos_hitos') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE ${SCHEMA}.proyectos_hitos ALTER COLUMN id SET DEFAULT nextval(''${SCHEMA}.${SEQ}''::regclass)';
          EXECUTE 'ALTER SEQUENCE ${SCHEMA}.${SEQ} OWNED BY ${SCHEMA}.proyectos_hitos.id';
          EXECUTE 'SELECT setval(''${SCHEMA}.${SEQ}'', COALESCE((SELECT MAX(id) FROM ${SCHEMA}.proyectos_hitos), 0) + 1, false)';
        END IF;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Reversión conservadora: sólo revoca default privileges y grants de schema/objetos.
  pgm.sql(`
    DO $$
    DECLARE
      owner_role text;
      app_role text;
    BEGIN
      FOREACH owner_role IN ARRAY ARRAY['${OWNER_ROLES.join("','")}'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
          FOREACH app_role IN ARRAY ARRAY['${APP_ROLES.join("','")}'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
              BEGIN
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM %I',
                  owner_role, app_role
                );
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM %I',
                  owner_role, app_role
                );
                EXECUTE format(
                  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ${SCHEMA} REVOKE EXECUTE ON FUNCTIONS FROM %I',
                  owner_role, app_role
                );
              EXCEPTION
                WHEN insufficient_privilege THEN
                  RAISE NOTICE 'Sin privilegio para revertir ALTER DEFAULT PRIVILEGES FOR ROLE %', owner_role;
              END;
            END IF;
          END LOOP;
        END IF;
      END LOOP;

      FOREACH app_role IN ARRAY ARRAY['${APP_ROLES.join("','")}'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
          EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} FROM %I', app_role);
          EXECUTE format('REVOKE USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${SCHEMA} FROM %I', app_role);
          EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SCHEMA} FROM %I', app_role);
          EXECUTE format('REVOKE USAGE ON SCHEMA ${SCHEMA} FROM %I', app_role);
        END IF;
      END LOOP;
    END $$;
  `);
};
