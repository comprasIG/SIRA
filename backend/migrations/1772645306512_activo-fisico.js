/* backend/migrations/1772645306512_activo-fisico.js */
exports.shorthands = undefined;

const SCHEMA = 'public';
const q = (t) => `${SCHEMA}.${t}`;

// Enums
const ENUM_ESTATUS = 'activo_fisico_estatus';
const ENUM_TIPO_MOV = 'activo_fisico_tipo_movimiento';

// Tablas (SIN schema en pgm.*)
const T_CATEG = 'catalogo_activo_fisico_categorias';
const T_TIPOS = 'catalogo_activo_fisico_tipos';
const T_UBIC = 'catalogo_activo_fisico_ubicaciones';
const T_ACTIVOS = 'activos_fisicos';
const T_MOV = 'activos_fisicos_movimientos';

// Sequence SKU
const SEQ_SKU = 'activos_fisicos_sku_seq';

// (Opcional) Grants helper si lo sigues usando
let grant_block;
try {
    ({ grant_block } = require('./_helpers/grants'));
} catch (_) {
    grant_block = null;
}

exports.up = (pgm) => {
    // 0) Limpieza defensiva por si quedó algo MAL creado (con puntos en el nombre)
    pgm.sql(`
    DROP TABLE IF EXISTS ${q(`"${SCHEMA}.${T_MOV}"`)} CASCADE;
    DROP TABLE IF EXISTS ${q(`"${SCHEMA}.${T_ACTIVOS}"`)} CASCADE;
    DROP TABLE IF EXISTS ${q(`"${SCHEMA}.${T_UBIC}"`)} CASCADE;
    DROP TABLE IF EXISTS ${q(`"${SCHEMA}.${T_TIPOS}"`)} CASCADE;
    DROP TABLE IF EXISTS ${q(`"${SCHEMA}.${T_CATEG}"`)} CASCADE;
    DROP SEQUENCE IF EXISTS ${q(`"${SCHEMA}.${SEQ_SKU}"`)} CASCADE;
  `);

    // 1) Menú / función del sistema
    pgm.sql(`
    INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta)
    VALUES ('act_fisico', 'Activo Físico', 'Almacén', 'HandymanIcon', '/activo_fisico')
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      modulo = EXCLUDED.modulo,
      icono = EXCLUDED.icono,
      ruta = EXCLUDED.ruta;
  `);

    // Acceso a todos los roles (mientras no cierres visibilidad por rol)
    pgm.sql(`
    INSERT INTO public.rol_funcion (rol_id, funcion_id)
    SELECT r.id, f.id
    FROM public.roles r
    CROSS JOIN (SELECT id FROM public.funciones WHERE codigo = 'act_fisico') f
    ON CONFLICT DO NOTHING;
  `);

    // 2) Types (creación segura)
    pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE t.typname='${ENUM_ESTATUS}' AND n.nspname='${SCHEMA}'
      ) THEN
        EXECUTE 'CREATE TYPE ${SCHEMA}.${ENUM_ESTATUS} AS ENUM (''ACTIVO'',''EN_MANTENIMIENTO'',''BAJA'')';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE t.typname='${ENUM_TIPO_MOV}' AND n.nspname='${SCHEMA}'
      ) THEN
        EXECUTE 'CREATE TYPE ${SCHEMA}.${ENUM_TIPO_MOV} AS ENUM (
          ''ALTA'',
          ''CAMBIO_RESPONSABLE'',
          ''CAMBIO_UBICACION'',
          ''CAMBIO_RESPONSABLE_Y_UBICACION'',
          ''BAJA'',
          ''REACTIVACION'',
          ''OTRO''
        )';
      END IF;
    END $$;
  `);

    // 3) Catálogos
    pgm.createTable(T_CATEG, {
        id: 'id',
        clave: { type: 'varchar(20)', notNull: true, unique: true },
        nombre: { type: 'varchar(100)', notNull: true },
        descripcion: { type: 'text' },
        activo: { type: 'boolean', notNull: true, default: true },
        creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex(T_CATEG, ['nombre'], { unique: true, name: 'uq_act_fisico_categorias_nombre' });

    pgm.createTable(T_TIPOS, {
        id: 'id',
        categoria_id: { type: 'int4', notNull: true, references: `${T_CATEG}(id)`, onDelete: 'RESTRICT' },
        clave: { type: 'varchar(20)', notNull: true },
        nombre: { type: 'varchar(100)', notNull: true },
        descripcion: { type: 'text' },
        activo: { type: 'boolean', notNull: true, default: true },
        creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint(T_TIPOS, 'uq_act_fisico_tipos_categoria_clave', { unique: ['categoria_id', 'clave'] });
    pgm.addConstraint(T_TIPOS, 'uq_act_fisico_tipos_categoria_nombre', { unique: ['categoria_id', 'nombre'] });
    // para poder referenciar (id,categoria_id)
    pgm.addConstraint(T_TIPOS, 'uq_act_fisico_tipos_id_categoria', { unique: ['id', 'categoria_id'] });

    pgm.createTable(T_UBIC, {
        id: 'id',
        clave: { type: 'varchar(30)', notNull: true, unique: true },
        nombre: { type: 'varchar(150)', notNull: true },
        descripcion: { type: 'text' },
        parent_id: { type: 'int4', references: `${T_UBIC}(id)`, onDelete: 'SET NULL' },
        activo: { type: 'boolean', notNull: true, default: true },
        creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // Triggers update_timestamp() (ya existe en tu BD):contentReference[oaicite:1]{index=1}
    pgm.sql(`
    CREATE TRIGGER trg_catalogo_act_fisico_categorias_update
    BEFORE UPDATE ON ${q(T_CATEG)}
    FOR EACH ROW EXECUTE FUNCTION ${q('update_timestamp')}();

    CREATE TRIGGER trg_catalogo_act_fisico_tipos_update
    BEFORE UPDATE ON ${q(T_TIPOS)}
    FOR EACH ROW EXECUTE FUNCTION ${q('update_timestamp')}();

    CREATE TRIGGER trg_catalogo_act_fisico_ubicaciones_update
    BEFORE UPDATE ON ${q(T_UBIC)}
    FOR EACH ROW EXECUTE FUNCTION ${q('update_timestamp')}();
  `);

    // 4) Sequence SKU
    pgm.createSequence(SEQ_SKU);

    // 5) Master: activos_fisicos
    pgm.createTable(T_ACTIVOS, {
        id: 'id',
        categoria_id: { type: 'int4', notNull: true, references: `${T_CATEG}(id)`, onDelete: 'RESTRICT' },
        tipo_id: { type: 'int4', notNull: true },

        sku: { type: 'varchar(80)', notNull: true, unique: true },
        codigo: { type: 'varchar(80)' },

        marca: { type: 'varchar(100)' },
        modelo: { type: 'varchar(100)' },
        nombre: { type: 'varchar(150)', notNull: true },
        detalle_tecnico: { type: 'text' },
        numero_serie: { type: 'varchar(120)' },

        fecha_compra: { type: 'date' },
        costo_compra: { type: 'numeric(14,4)' },
        // catalogo_monedas PK es (codigo):contentReference[oaicite:2]{index=2}
        moneda: { type: 'bpchar(3)', references: `catalogo_monedas(codigo)`, onDelete: 'SET NULL' },
        proveedor_id: { type: 'int4', references: `proveedores(id)`, onDelete: 'SET NULL' },

        estatus: { type: `${SCHEMA}.${ENUM_ESTATUS}`, notNull: true, default: 'ACTIVO' },
        activo: { type: 'boolean', notNull: true, default: true },

        empleado_responsable_actual_id: { type: 'int4', references: `empleados(id)`, onDelete: 'SET NULL' },
        ubicacion_actual_id: { type: 'int4', references: `${T_UBIC}(id)`, onDelete: 'SET NULL' },

        creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // FK compuesta: tipo debe pertenecer a categoría
    pgm.sql(`
    ALTER TABLE ${q(T_ACTIVOS)}
    ADD CONSTRAINT fk_act_fisico_tipo_y_categoria
    FOREIGN KEY (tipo_id, categoria_id)
    REFERENCES ${q(T_TIPOS)} (id, categoria_id)
    ON DELETE RESTRICT;
  `);

    // unique parcial para numero_serie
    pgm.createIndex(T_ACTIVOS, ['numero_serie'], {
        name: 'uq_activos_fisicos_numero_serie_not_null',
        unique: true,
        where: 'numero_serie IS NOT NULL',
    });

    // update_timestamp en activos
    pgm.sql(`
    CREATE TRIGGER trg_activos_fisicos_update
    BEFORE UPDATE ON ${q(T_ACTIVOS)}
    FOR EACH ROW EXECUTE FUNCTION ${q('update_timestamp')}();
  `);

    // 6) SKU autogenerado (estable)
    pgm.sql(`
    CREATE OR REPLACE FUNCTION ${q('f_activo_fisico_set_sku')}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_cat_clave text;
      v_tipo_clave text;
      v_consecutivo bigint;
    BEGIN
      IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
        SELECT c.clave, t.clave
          INTO v_cat_clave, v_tipo_clave
        FROM ${q(T_CATEG)} c
        JOIN ${q(T_TIPOS)} t ON t.categoria_id = c.id
        WHERE c.id = NEW.categoria_id
          AND t.id = NEW.tipo_id;

        IF v_cat_clave IS NULL OR v_tipo_clave IS NULL THEN
          RAISE EXCEPTION 'No se pudo generar SKU: categoria_id (%) / tipo_id (%) inválidos o no corresponden.',
            NEW.categoria_id, NEW.tipo_id;
        END IF;

        v_consecutivo := nextval('${q(SEQ_SKU)}');
        NEW.sku := v_cat_clave || '.' || v_tipo_clave || '.' || lpad(v_consecutivo::text, 6, '0');
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_activos_fisicos_set_sku
    BEFORE INSERT ON ${q(T_ACTIVOS)}
    FOR EACH ROW EXECUTE FUNCTION ${q('f_activo_fisico_set_sku')}();
  `);

    // 7) Movimientos
    pgm.createTable(T_MOV, {
        id: 'id',
        activo_fisico_id: { type: 'int4', notNull: true, references: `${T_ACTIVOS}(id)`, onDelete: 'CASCADE' },
        consecutivo: { type: 'int4', notNull: true },

        usuario_id: { type: 'int4', notNull: true, references: `usuarios(id)`, onDelete: 'RESTRICT' },
        fecha_movimiento: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },

        tipo_movimiento: { type: `${SCHEMA}.${ENUM_TIPO_MOV}`, notNull: true },

        empleado_responsable_anterior_id: { type: 'int4', references: `empleados(id)`, onDelete: 'SET NULL' },
        empleado_responsable_nuevo_id: { type: 'int4', references: `empleados(id)`, onDelete: 'SET NULL' },

        ubicacion_anterior_id: { type: 'int4', references: `${T_UBIC}(id)`, onDelete: 'SET NULL' },
        ubicacion_nueva_id: { type: 'int4', references: `${T_UBIC}(id)`, onDelete: 'SET NULL' },

        observaciones: { type: 'text' },

        estado: { type: 'varchar(12)', notNull: true, default: 'ACTIVO' },
        anulado_en: { type: 'timestamptz' },
        anulado_por: { type: 'int4', references: `usuarios(id)`, onDelete: 'SET NULL' },
        motivo_anulacion: { type: 'text' },
        reversa_de_movimiento_id: { type: 'int4', references: `${T_MOV}(id)`, onDelete: 'SET NULL' },
    });

    pgm.addConstraint(T_MOV, 'uq_act_fisico_mov_activo_consecutivo', { unique: ['activo_fisico_id', 'consecutivo'] });
    pgm.addConstraint(T_MOV, 'chk_act_fisico_mov_estado', { check: `estado IN ('ACTIVO','ANULADO')` });

    pgm.createIndex(T_MOV, ['activo_fisico_id', 'fecha_movimiento'], { name: 'idx_act_fisico_mov_activo_fecha' });
    pgm.createIndex(T_MOV, ['usuario_id'], { name: 'idx_act_fisico_mov_usuario' });
    pgm.createIndex(T_MOV, ['empleado_responsable_nuevo_id'], { name: 'idx_act_fisico_mov_resp_nuevo' });
    pgm.createIndex(T_MOV, ['ubicacion_nueva_id'], { name: 'idx_act_fisico_mov_ubic_nueva' });

    // 8) Snapshot pointer
    pgm.addColumn(T_ACTIVOS, {
        ultimo_movimiento_id: { type: 'int4', references: `${T_MOV}(id)`, onDelete: 'SET NULL' },
    });

    // 9) Triggers de movimientos (consecutivo + snapshot)
    pgm.sql(`
    CREATE OR REPLACE FUNCTION ${q('f_activo_fisico_mov_before_insert')}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_resp_actual int4;
      v_ubic_actual int4;
      v_esta_baja boolean;
      v_next int4;
      v_resp_changed boolean;
      v_ubic_changed boolean;
    BEGIN
      SELECT empleado_responsable_actual_id, ubicacion_actual_id, (estatus = 'BAJA'::${SCHEMA}.${ENUM_ESTATUS})
        INTO v_resp_actual, v_ubic_actual, v_esta_baja
      FROM ${q(T_ACTIVOS)}
      WHERE id = NEW.activo_fisico_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Activo físico (%) no existe.', NEW.activo_fisico_id;
      END IF;

      IF v_esta_baja AND NEW.tipo_movimiento <> 'REACTIVACION'::${SCHEMA}.${ENUM_TIPO_MOV} THEN
        RAISE EXCEPTION 'El activo (%) está en BAJA; solo permite movimiento REACTIVACION.', NEW.activo_fisico_id;
      END IF;

      SELECT COALESCE(MAX(consecutivo), 0) + 1
        INTO v_next
      FROM ${q(T_MOV)}
      WHERE activo_fisico_id = NEW.activo_fisico_id;

      NEW.consecutivo := COALESCE(NEW.consecutivo, v_next);

      IF NEW.empleado_responsable_anterior_id IS NULL THEN
        NEW.empleado_responsable_anterior_id := v_resp_actual;
      END IF;

      IF NEW.ubicacion_anterior_id IS NULL THEN
        NEW.ubicacion_anterior_id := v_ubic_actual;
      END IF;

      -- Inferir tipo si llega NULL (trigger BEFORE corre antes del NOT NULL check)
      IF NEW.tipo_movimiento IS NULL THEN
        v_resp_changed :=
          NEW.empleado_responsable_nuevo_id IS NOT NULL
          AND NEW.empleado_responsable_nuevo_id IS DISTINCT FROM v_resp_actual;

        v_ubic_changed :=
          NEW.ubicacion_nueva_id IS NOT NULL
          AND NEW.ubicacion_nueva_id IS DISTINCT FROM v_ubic_actual;

        IF v_resp_actual IS NULL AND v_ubic_actual IS NULL THEN
          NEW.tipo_movimiento := 'ALTA'::${SCHEMA}.${ENUM_TIPO_MOV};
        ELSIF v_resp_changed AND v_ubic_changed THEN
          NEW.tipo_movimiento := 'CAMBIO_RESPONSABLE_Y_UBICACION'::${SCHEMA}.${ENUM_TIPO_MOV};
        ELSIF v_resp_changed THEN
          NEW.tipo_movimiento := 'CAMBIO_RESPONSABLE'::${SCHEMA}.${ENUM_TIPO_MOV};
        ELSIF v_ubic_changed THEN
          NEW.tipo_movimiento := 'CAMBIO_UBICACION'::${SCHEMA}.${ENUM_TIPO_MOV};
        ELSE
          NEW.tipo_movimiento := 'OTRO'::${SCHEMA}.${ENUM_TIPO_MOV};
        END IF;
      END IF;

      IF NEW.tipo_movimiento = 'ALTA'::${SCHEMA}.${ENUM_TIPO_MOV}
         AND NEW.empleado_responsable_nuevo_id IS NULL
         AND NEW.ubicacion_nueva_id IS NULL THEN
        RAISE EXCEPTION 'Movimiento ALTA requiere empleado_responsable_nuevo_id y/o ubicacion_nueva_id.';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION ${q('f_activo_fisico_mov_after_insert')}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.estado <> 'ACTIVO' THEN
        RETURN NULL;
      END IF;

      UPDATE ${q(T_ACTIVOS)}
      SET
        empleado_responsable_actual_id = COALESCE(NEW.empleado_responsable_nuevo_id, empleado_responsable_actual_id),
        ubicacion_actual_id = COALESCE(NEW.ubicacion_nueva_id, ubicacion_actual_id),
        ultimo_movimiento_id = NEW.id,
        estatus = CASE
          WHEN NEW.tipo_movimiento = 'BAJA'::${SCHEMA}.${ENUM_TIPO_MOV} THEN 'BAJA'::${SCHEMA}.${ENUM_ESTATUS}
          WHEN NEW.tipo_movimiento = 'REACTIVACION'::${SCHEMA}.${ENUM_TIPO_MOV} THEN 'ACTIVO'::${SCHEMA}.${ENUM_ESTATUS}
          ELSE estatus
        END
      WHERE id = NEW.activo_fisico_id;

      RETURN NULL;
    END;
    $$;

    CREATE TRIGGER trg_activo_fisico_mov_before_insert
    BEFORE INSERT ON ${q(T_MOV)}
    FOR EACH ROW EXECUTE FUNCTION ${q('f_activo_fisico_mov_before_insert')}();

    CREATE TRIGGER trg_activo_fisico_mov_after_insert
    AFTER INSERT ON ${q(T_MOV)}
    FOR EACH ROW EXECUTE FUNCTION ${q('f_activo_fisico_mov_after_insert')}();
  `);

    // 10) Grants (si estás usando helper)
    if (grant_block) {
        pgm.sql(
            grant_block({
                schema: 'public',
                tables: [T_CATEG, T_TIPOS, T_UBIC, T_ACTIVOS, T_MOV],
                sequences: [SEQ_SKU],
            })
        );
    }
};

exports.down = (pgm) => {
    pgm.sql(`
    DELETE FROM public.rol_funcion
    WHERE funcion_id IN (SELECT id FROM public.funciones WHERE codigo = 'act_fisico');

    DELETE FROM public.funciones WHERE codigo = 'act_fisico';
  `);

    pgm.sql(`
    DROP TRIGGER IF EXISTS trg_activo_fisico_mov_after_insert ON ${q(T_MOV)};
    DROP TRIGGER IF EXISTS trg_activo_fisico_mov_before_insert ON ${q(T_MOV)};
    DROP FUNCTION IF EXISTS ${q('f_activo_fisico_mov_after_insert')}();
    DROP FUNCTION IF EXISTS ${q('f_activo_fisico_mov_before_insert')}();

    DROP TRIGGER IF EXISTS trg_activos_fisicos_set_sku ON ${q(T_ACTIVOS)};
    DROP FUNCTION IF EXISTS ${q('f_activo_fisico_set_sku')}();

    DROP TRIGGER IF EXISTS trg_activos_fisicos_update ON ${q(T_ACTIVOS)};
    DROP TRIGGER IF EXISTS trg_catalogo_act_fisico_ubicaciones_update ON ${q(T_UBIC)};
    DROP TRIGGER IF EXISTS trg_catalogo_act_fisico_tipos_update ON ${q(T_TIPOS)};
    DROP TRIGGER IF EXISTS trg_catalogo_act_fisico_categorias_update ON ${q(T_CATEG)};
  `);

    pgm.dropTable(T_MOV);
    pgm.dropTable(T_ACTIVOS);
    pgm.dropTable(T_UBIC);
    pgm.dropTable(T_TIPOS);
    pgm.dropTable(T_CATEG);

    pgm.dropSequence(SEQ_SKU);

    pgm.sql(`
    DROP TYPE IF EXISTS ${q(ENUM_TIPO_MOV)};
    DROP TYPE IF EXISTS ${q(ENUM_ESTATUS)};
  `);
};