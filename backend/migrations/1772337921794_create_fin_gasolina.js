/**
 * Objetivo (Prompt #1):
 * - Crear las tablas para registrar cargas de gasolina por unidad y permitir registrar pagos agrupados
 *   (un depósito que cubra múltiples cargas).
 *
 * Diseño:
 * - public.fin_gasolina_pagos: "header" del depósito/pago (fuente, total, comprobante, usuario)
 * - public.fin_gasolina_cargas: cada carga (unidad, km, costo MXN, sitio/proyecto destino opcional)
 *
 * Notas ERP:
 * - `tipo_combustible` se toma de `public.unidades.tipo_combustible` (se guarda como snapshot por auditoría).
 * - `pagado` se controla con `pago_id` (si tiene pago asociado => pagado = true).
 */

exports.shorthands = undefined;


const { grant_block } = require('./_helpers/grants');
exports.up = (pgm) => {
  // 1) Tabla de pagos (depósitos) de gasolina
  pgm.createTable('fin_gasolina_pagos', {
    id: 'id',
    fecha_pago: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    fuente_pago_id: {
      type: 'integer',
      notNull: true,
      references: 'catalogo_fuentes_pago(id)',
      onDelete: 'RESTRICT',
    },
    usuario_id: {
      type: 'integer',
      notNull: true,
      references: 'usuarios(id)',
      onDelete: 'RESTRICT',
    },
    total_mxn: { type: 'numeric(14,2)', notNull: true },
    comprobante_link: { type: 'text', notNull: false }, // URL a Drive/Bucket
    comentario: { type: 'text', notNull: false },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Índices típicos para filtros/reportes
  pgm.createIndex('fin_gasolina_pagos', 'fuente_pago_id');
  pgm.createIndex('fin_gasolina_pagos', 'usuario_id');
  pgm.sql(`CREATE INDEX idx_fin_gasolina_pagos_fecha_pago_desc ON public.fin_gasolina_pagos (fecha_pago DESC);`);

  // Trigger de actualizado_en
  pgm.sql(`
    CREATE TRIGGER trg_fin_gasolina_pagos_update
    BEFORE UPDATE ON public.fin_gasolina_pagos
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 2) Tabla de cargas de gasolina
  pgm.createTable('fin_gasolina_cargas', {
    id: 'id',
    fecha_carga: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },

    unidad_id: {
      type: 'integer',
      notNull: true,
      references: 'unidades(id)',
      onDelete: 'RESTRICT',
    },

    kilometraje: { type: 'integer', notNull: true },
    costo_total_mxn: { type: 'numeric(14,2)', notNull: true },

    // Snapshot para auditoría (se setea por trigger desde unidades)
    tipo_combustible: { type: 'varchar(50)', notNull: false },

    // Destino (opcional) - mismo concepto que en G_REQ (sitio/proyecto)
    sitio_destino_id: { type: 'integer', notNull: false, references: 'sitios(id)', onDelete: 'SET NULL' },
    proyecto_destino_id: { type: 'integer', notNull: false, references: 'proyectos(id)', onDelete: 'SET NULL' },

    // Quién la registró
    usuario_id: { type: 'integer', notNull: true, references: 'usuarios(id)', onDelete: 'RESTRICT' },

    // Control de pago
    pagado: { type: 'boolean', notNull: true, default: false },
    pago_id: { type: 'integer', notNull: false, references: 'fin_gasolina_pagos(id)', onDelete: 'SET NULL' },
    fuente_pago_id: { type: 'integer', notNull: false, references: 'catalogo_fuentes_pago(id)', onDelete: 'SET NULL' },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Reglas de integridad básicas
  pgm.addConstraint('fin_gasolina_cargas', 'chk_fin_gasolina_km_nonneg', {
    check: 'kilometraje >= 0',
  });
  pgm.addConstraint('fin_gasolina_cargas', 'chk_fin_gasolina_costo_pos', {
    check: 'costo_total_mxn > 0',
  });

  // Índices para consultas habituales
  pgm.createIndex('fin_gasolina_cargas', 'unidad_id');
  pgm.createIndex('fin_gasolina_cargas', 'usuario_id');
  pgm.createIndex('fin_gasolina_cargas', 'sitio_destino_id');
  pgm.createIndex('fin_gasolina_cargas', 'proyecto_destino_id');
  pgm.createIndex('fin_gasolina_cargas', 'pagado');
  pgm.sql(`CREATE INDEX idx_fin_gasolina_cargas_fecha_carga_desc ON public.fin_gasolina_cargas (fecha_carga DESC);`);

  // Trigger de actualizado_en
  pgm.sql(`
    CREATE TRIGGER trg_fin_gasolina_cargas_update
    BEFORE UPDATE ON public.fin_gasolina_cargas
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // 3) Trigger de negocio: setear tipo_combustible desde unidades + sincronizar pagado/fuente cuando se asigna pago_id
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.fn_fin_gasolina_cargas_set_derived()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_tipo varchar(50);
      v_fuente int;
    BEGIN
      -- Siempre tomar tipo_combustible desde unidades (requisito del prompt)
      SELECT u.tipo_combustible INTO v_tipo
      FROM public.unidades u
      WHERE u.id = NEW.unidad_id;

      NEW.tipo_combustible := v_tipo;

      -- Si se asigna un pago, entonces está pagado y la fuente viene del pago (depósito)
      IF NEW.pago_id IS NOT NULL THEN
        SELECT p.fuente_pago_id INTO v_fuente
        FROM public.fin_gasolina_pagos p
        WHERE p.id = NEW.pago_id;

        NEW.fuente_pago_id := v_fuente;
        NEW.pagado := true;
      ELSE
        -- Si no hay pago asociado, forzamos no pagado (evita inconsistencias)
        NEW.pagado := false;
        NEW.fuente_pago_id := NULL;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_fin_gasolina_cargas_set_derived
    BEFORE INSERT OR UPDATE OF unidad_id, pago_id
    ON public.fin_gasolina_cargas
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_fin_gasolina_cargas_set_derived();
  `);

  // 4) Permisos (robusto para que corra en STG/PRD)
  pgm.sql(grant_block({ tables: ["fin_gasolina_pagos","fin_gasolina_cargas"], sequences: ["fin_gasolina_pagos_id_seq","fin_gasolina_cargas_id_seq"] }));
};

exports.down = (pgm) => {
  // Revertimos en orden inverso
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_fin_gasolina_cargas_set_derived ON public.fin_gasolina_cargas;
    DROP FUNCTION IF EXISTS public.fn_fin_gasolina_cargas_set_derived();
  `);

  pgm.sql(`DROP TRIGGER IF EXISTS trg_fin_gasolina_cargas_update ON public.fin_gasolina_cargas;`);
  pgm.dropTable('fin_gasolina_cargas');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_fin_gasolina_pagos_update ON public.fin_gasolina_pagos;`);
  pgm.dropTable('fin_gasolina_pagos');
};
