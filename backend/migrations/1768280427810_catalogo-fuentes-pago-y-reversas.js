/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
     // ============================
  // 1) Catálogo de fuentes de pago
  // ============================
  pgm.createTable('catalogo_fuentes_pago', {
    id: 'id',
    nombre: { type: 'varchar(120)', notNull: true, unique: true },
    tipo: { type: 'varchar(20)', notNull: true, default: `'OTRO'` }, // BANCO | EFECTIVO | TARJETA | OTRO
    activo: { type: 'boolean', notNull: true, default: true },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('catalogo_fuentes_pago', 'catalogo_fuentes_pago_tipo_check', {
    check: `tipo IN ('BANCO','EFECTIVO','TARJETA','OTRO')`,
  });

  // Trigger update_timestamp (ya existe en tu BD)
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_catalogo_fuentes_pago_update ON public.catalogo_fuentes_pago;
    CREATE TRIGGER trg_catalogo_fuentes_pago_update
    BEFORE UPDATE ON public.catalogo_fuentes_pago
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // Seeds (puedes ajustar luego desde UI)
  pgm.sql(`
    INSERT INTO public.catalogo_fuentes_pago (nombre, tipo, activo)
    VALUES
      ('NO ESPECIFICADO', 'OTRO', true),
      ('Santander', 'BANCO', true),
      ('BBVA', 'BANCO', true),
      ('Monex', 'BANCO', true),
      ('Efectivo Caja Finanzas', 'EFECTIVO', true),
      ('Efectivo Caja Chica Compras', 'EFECTIVO', true),
      ('Efectivo Caja Chica Vita', 'EFECTIVO', true),
      ('Tarjeta de Crédito', 'TARJETA', true)
    ON CONFLICT (nombre) DO NOTHING;
  `);

  // ============================
  // 2) Extender pagos_oc
  // ============================
  pgm.addColumns('pagos_oc', {
    fuente_pago_id: { type: 'integer' },
    reversa_de_pago_id: { type: 'integer' },
    fecha_compromiso_pago: { type: 'date' }, // para "próxima fecha comprometida" (especialmente en anticipos)
  });

  // FK fuente_pago_id
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    ADD CONSTRAINT pagos_oc_fuente_pago_id_fkey
    FOREIGN KEY (fuente_pago_id)
    REFERENCES public.catalogo_fuentes_pago(id)
    ON DELETE RESTRICT;
  `);

  // FK reversa_de_pago_id
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    ADD CONSTRAINT pagos_oc_reversa_de_pago_id_fkey
    FOREIGN KEY (reversa_de_pago_id)
    REFERENCES public.pagos_oc(id)
    ON DELETE RESTRICT;
  `);

  // CHECK tipo_pago: agregar REVERSA (sin romper los anteriores)
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    DROP CONSTRAINT IF EXISTS pagos_oc_tipo_pago_check;

    ALTER TABLE public.pagos_oc
    ADD CONSTRAINT pagos_oc_tipo_pago_check
    CHECK ((tipo_pago)::text = ANY ((ARRAY['TOTAL','ANTICIPO','REVERSA'])::text[]));
  `);

  // Backfill fuente_pago_id para registros existentes
  pgm.sql(`
    UPDATE public.pagos_oc
    SET fuente_pago_id = (SELECT id FROM public.catalogo_fuentes_pago WHERE nombre = 'NO ESPECIFICADO' LIMIT 1)
    WHERE fuente_pago_id IS NULL;
  `);

  // Forzar NOT NULL en fuente_pago_id (para que todo pago nuevo sea trazable)
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    ALTER COLUMN fuente_pago_id SET NOT NULL;
  `);

  // ============================
  // 3) Recalcular monto_pagado + pendiente_liquidar + estatus_pago desde pagos_oc (ledger)
  //    Reemplazamos tu función actual f_actualizar_liquidacion_oc
  // ============================
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.f_actualizar_liquidacion_oc()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      total_oc numeric(14,4);
      suma_pagos numeric(14,4);
      estado_oc public.orden_compra_status;
    BEGIN
      SELECT total, status
        INTO total_oc, estado_oc
      FROM public.ordenes_compra
      WHERE id = NEW.orden_compra_id;

      SELECT COALESCE(SUM(monto),0)
        INTO suma_pagos
      FROM public.pagos_oc
      WHERE orden_compra_id = NEW.orden_compra_id;

      UPDATE public.ordenes_compra
      SET
        monto_pagado = suma_pagos,
        estatus_pago = CASE
          WHEN suma_pagos <= 0 THEN 'PENDIENTE'::public.estatus_pago_enum
          WHEN suma_pagos < total_oc THEN 'PARCIAL'::public.estatus_pago_enum
          ELSE 'PAGADO'::public.estatus_pago_enum
        END,
        -- CxP SOLO si ya está en estados operativos/financieros posteriores a autorización (y con saldo)
        pendiente_liquidar = CASE
          WHEN estado_oc IN ('APROBADA','EN_PROCESO','ENTREGADA') AND suma_pagos < total_oc THEN true
          ELSE false
        END,
        actualizado_en = now()
      WHERE id = NEW.orden_compra_id;

      RETURN NEW;
    END;
    $$;
  `);

  // Backfill de ordenes_compra (para dejar consistente desde ya)
  pgm.sql(`
    WITH sumas AS (
      SELECT orden_compra_id, COALESCE(SUM(monto),0) AS suma
      FROM public.pagos_oc
      GROUP BY orden_compra_id
    )
    UPDATE public.ordenes_compra oc
    SET
      monto_pagado = COALESCE(s.suma, 0),
      estatus_pago = CASE
        WHEN COALESCE(s.suma,0) <= 0 THEN 'PENDIENTE'::public.estatus_pago_enum
        WHEN COALESCE(s.suma,0) < oc.total THEN 'PARCIAL'::public.estatus_pago_enum
        ELSE 'PAGADO'::public.estatus_pago_enum
      END,
      pendiente_liquidar = CASE
        WHEN oc.status IN ('APROBADA','EN_PROCESO','ENTREGADA') AND COALESCE(s.suma,0) < oc.total THEN true
        ELSE false
      END
    FROM sumas s
    WHERE oc.id = s.orden_compra_id;

    -- Para OCs sin pagos:
    UPDATE public.ordenes_compra
    SET
      monto_pagado = COALESCE(monto_pagado,0),
      estatus_pago = 'PENDIENTE'::public.estatus_pago_enum
    WHERE monto_pagado IS NULL;
  `);

  // ============================
  // 4) Nueva función en sidebar (opcional pero recomendado)
  // ============================
  pgm.sql(`
    INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta)
    VALUES ('FIN_FUENTES_PAGO', 'Fuentes de Pago', 'Finanzas', 'PriceCheckIcon', '/FIN_FUENTES_PAGO')
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      modulo = EXCLUDED.modulo,
      icono  = EXCLUDED.icono,
      ruta   = EXCLUDED.ruta;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     // Quitar función del sidebar
  pgm.sql(`DELETE FROM public.funciones WHERE codigo = 'FIN_FUENTES_PAGO';`);

  // Regresar pagos_oc
  pgm.sql(`
    ALTER TABLE public.pagos_oc DROP CONSTRAINT IF EXISTS pagos_oc_reversa_de_pago_id_fkey;
    ALTER TABLE public.pagos_oc DROP CONSTRAINT IF EXISTS pagos_oc_fuente_pago_id_fkey;
  `);

  pgm.dropColumns('pagos_oc', ['fuente_pago_id', 'reversa_de_pago_id', 'fecha_compromiso_pago']);

  // Restaurar CHECK original
  pgm.sql(`
    ALTER TABLE public.pagos_oc
    DROP CONSTRAINT IF EXISTS pagos_oc_tipo_pago_check;

    ALTER TABLE public.pagos_oc
    ADD CONSTRAINT pagos_oc_tipo_pago_check
    CHECK ((tipo_pago)::text = ANY ((ARRAY['TOTAL','ANTICIPO'])::text[]));
  `);

  // Eliminar catálogo
  pgm.dropTable('catalogo_fuentes_pago');
};
