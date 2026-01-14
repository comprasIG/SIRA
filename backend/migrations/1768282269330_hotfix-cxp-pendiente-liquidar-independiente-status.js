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
     // 1) Reemplazar función que recalcula monto_pagado/estatus_pago/pendiente_liquidar
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
        -- ✅ CxP = saldo > 0 (independiente del status operativo)
        -- Solo excluimos estados que NO deben considerarse cuentas por pagar
        pendiente_liquidar = CASE
          WHEN (suma_pagos < total_oc)
           AND estado_oc NOT IN ('POR_AUTORIZAR','RECHAZADA','CANCELADA','HOLD','CONFIRMAR_SPEI')
          THEN true
          ELSE false
        END,
        actualizado_en = now()
      WHERE id = NEW.orden_compra_id;

      RETURN NEW;
    END;
    $$;
  `);

  // 2) Asegurar trigger en pagos_oc (INSERT/UPDATE/DELETE)
  //    Si ya existe con otro nombre, no pasa nada: este bloque asegura que al menos uno exista.
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_actualizar_liquidacion_oc ON public.pagos_oc;
    CREATE TRIGGER trg_actualizar_liquidacion_oc
    AFTER INSERT OR UPDATE OR DELETE ON public.pagos_oc
    FOR EACH ROW
    EXECUTE FUNCTION public.f_actualizar_liquidacion_oc();
  `);

  // 3) Backfill masivo para corregir pendientes existentes (como tu OC ENTREGADA con saldo)
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
        WHEN (COALESCE(s.suma,0) < oc.total)
         AND oc.status NOT IN ('POR_AUTORIZAR','RECHAZADA','CANCELADA','HOLD','CONFIRMAR_SPEI')
        THEN true
        ELSE false
      END
    FROM sumas s
    WHERE oc.id = s.orden_compra_id;

    -- OCs sin pagos (no están en sumas):
    UPDATE public.ordenes_compra oc
    SET
      monto_pagado = COALESCE(oc.monto_pagado, 0),
      estatus_pago = CASE
        WHEN COALESCE(oc.monto_pagado,0) <= 0 THEN 'PENDIENTE'::public.estatus_pago_enum
        WHEN COALESCE(oc.monto_pagado,0) < oc.total THEN 'PARCIAL'::public.estatus_pago_enum
        ELSE 'PAGADO'::public.estatus_pago_enum
      END,
      pendiente_liquidar = CASE
        WHEN (COALESCE(oc.monto_pagado,0) < oc.total)
         AND oc.status NOT IN ('POR_AUTORIZAR','RECHAZADA','CANCELADA','HOLD','CONFIRMAR_SPEI')
        THEN true
        ELSE false
      END
    WHERE oc.id NOT IN (SELECT orden_compra_id FROM public.pagos_oc GROUP BY orden_compra_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Down conservador: no intentamos restaurar versiones anteriores desconocidas.
  // Solo dejamos el trigger como estaba (si lo borras, podrías romper cálculos).
  // Si quieres un down real, necesito la versión exacta previa de la función en tu repo.
  pgm.sql(`
    -- No-op (down conservador)
  `);
};
