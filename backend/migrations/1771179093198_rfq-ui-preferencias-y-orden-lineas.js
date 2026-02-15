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
    pgm.sql(`
    -- =====================================================================================
    -- 1) Función central: verifica y cierra requisición
    -- =====================================================================================
    CREATE OR REPLACE FUNCTION public.f_verificar_cierre_requisicion(p_requisicion_id int)
    RETURNS boolean
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_status public.requisicion_status;
      v_has_any_oc boolean;
      v_has_pending_oc_gen boolean;
      v_has_open_oc boolean;
      v_has_any_line_missing boolean;
      v_did_close boolean := false;
    BEGIN
      -- Bloqueo de la requisición para evitar carreras
      SELECT r.status
        INTO v_status
      FROM public.requisiciones r
      WHERE r.id = p_requisicion_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN false;
      END IF;

      -- No cerrar si ya está ENTREGADA o CANCELADA
      IF v_status IN ('ENTREGADA', 'CANCELADA') THEN
        RETURN false;
      END IF;

      -- Regla: si no hay OCs asociadas, NO cerrar
      SELECT EXISTS (
        SELECT 1
        FROM public.ordenes_compra oc
        WHERE oc.rfq_id = p_requisicion_id
      )
      INTO v_has_any_oc;

      IF NOT v_has_any_oc THEN
        RETURN false;
      END IF;

      -- (1) No debe haber opciones seleccionadas con cantidad_cotizada > 0 sin detalle de OC
      SELECT EXISTS (
        SELECT 1
        FROM public.requisiciones_opciones ro
        WHERE ro.requisicion_id = p_requisicion_id
          AND ro.seleccionado = true
          AND COALESCE(ro.cantidad_cotizada, 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM public.ordenes_compra_detalle ocd
            WHERE ocd.comparativa_precio_id = ro.id
          )
      )
      INTO v_has_pending_oc_gen;

      IF v_has_pending_oc_gen THEN
        RETURN false;
      END IF;

      -- (3) Todas las OCs deben estar resueltas: ENTREGADA / RECHAZADA / CANCELADA
      SELECT EXISTS (
        SELECT 1
        FROM public.ordenes_compra oc
        WHERE oc.rfq_id = p_requisicion_id
          AND oc.status NOT IN ('ENTREGADA', 'RECHAZADA', 'CANCELADA')
      )
      INTO v_has_open_oc;

      IF v_has_open_oc THEN
        RETURN false;
      END IF;

      -- (2) Para todas las líneas: sum(cantidad_recibida) >= cantidad solicitada
      -- Si existe alguna línea con recibido < solicitado, NO cerrar.
      SELECT EXISTS (
        SELECT 1
        FROM public.requisiciones_detalle rd
        LEFT JOIN (
          SELECT
            ocd.requisicion_detalle_id,
            SUM(ocd.cantidad_recibida) AS recibido_total
          FROM public.ordenes_compra_detalle ocd
          JOIN public.ordenes_compra oc ON oc.id = ocd.orden_compra_id
          WHERE oc.rfq_id = p_requisicion_id
          GROUP BY ocd.requisicion_detalle_id
        ) x ON x.requisicion_detalle_id = rd.id
        WHERE rd.requisicion_id = p_requisicion_id
          AND COALESCE(x.recibido_total, 0) < rd.cantidad
      )
      INTO v_has_any_line_missing;

      IF v_has_any_line_missing THEN
        RETURN false;
      END IF;

      -- Si llegó aquí, cumple TODO -> cerrar
      UPDATE public.requisiciones
      SET status = 'ENTREGADA',
          actualizado_en = NOW()
      WHERE id = p_requisicion_id
        AND status <> 'ENTREGADA';

      v_did_close := (FOUND);

      RETURN v_did_close;
    END;
    $$;

    -- =====================================================================================
    -- 2) Trigger function: desde ordenes_compra (cambio de status)
    -- =====================================================================================
    CREATE OR REPLACE FUNCTION public.trg_requisicion_cierre_desde_oc()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- NEW.rfq_id = requisicion_id
      PERFORM public.f_verificar_cierre_requisicion(NEW.rfq_id);
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_req_autocierre_from_oc ON public.ordenes_compra;
    CREATE TRIGGER trg_req_autocierre_from_oc
    AFTER UPDATE OF status ON public.ordenes_compra
    FOR EACH ROW
    WHEN (NEW.rfq_id IS NOT NULL)
    EXECUTE FUNCTION public.trg_requisicion_cierre_desde_oc();

    -- =====================================================================================
    -- 3) Trigger function: desde ordenes_compra_detalle (recepción / cambios relevantes)
    -- =====================================================================================
    CREATE OR REPLACE FUNCTION public.trg_requisicion_cierre_desde_ocd()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_req_id int;
    BEGIN
      -- Resolver requisicion_id desde requisiciones_detalle
      SELECT rd.requisicion_id
        INTO v_req_id
      FROM public.requisiciones_detalle rd
      WHERE rd.id = COALESCE(NEW.requisicion_detalle_id, OLD.requisicion_detalle_id);

      IF v_req_id IS NOT NULL THEN
        PERFORM public.f_verificar_cierre_requisicion(v_req_id);
      END IF;

      RETURN COALESCE(NEW, OLD);
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_req_autocierre_from_ocd_recibido ON public.ordenes_compra_detalle;
    CREATE TRIGGER trg_req_autocierre_from_ocd_recibido
    AFTER UPDATE OF cantidad_recibida ON public.ordenes_compra_detalle
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_requisicion_cierre_desde_ocd();

    -- Opcional pero útil: cuando se inserta/elimina detalle de OC (generación/cancelación)
    DROP TRIGGER IF EXISTS trg_req_autocierre_from_ocd_insdel ON public.ordenes_compra_detalle;
    CREATE TRIGGER trg_req_autocierre_from_ocd_insdel
    AFTER INSERT OR DELETE ON public.ordenes_compra_detalle
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_requisicion_cierre_desde_ocd();

    -- =====================================================================================
    -- 4) Trigger function: desde requisiciones_opciones (pendientes por generar OC)
    -- =====================================================================================
    CREATE OR REPLACE FUNCTION public.trg_requisicion_cierre_desde_opciones()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_req_id int;
    BEGIN
      v_req_id := COALESCE(NEW.requisicion_id, OLD.requisicion_id);

      IF v_req_id IS NOT NULL THEN
        PERFORM public.f_verificar_cierre_requisicion(v_req_id);
      END IF;

      RETURN COALESCE(NEW, OLD);
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_req_autocierre_from_opciones ON public.requisiciones_opciones;
    CREATE TRIGGER trg_req_autocierre_from_opciones
    AFTER INSERT OR UPDATE OR DELETE ON public.requisiciones_opciones
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_requisicion_cierre_desde_opciones();

    -- =====================================================================================
    -- 5) Backfill (aplica a requisiciones viejas)
    --    Nota: los triggers NO se disparan retroactivamente, por eso hacemos esto.
    -- =====================================================================================
    DO $$
    DECLARE
      r record;
    BEGIN
      -- Solo requisiciones que tengan al menos 1 OC.
      FOR r IN
        SELECT DISTINCT oc.rfq_id AS requisicion_id
        FROM public.ordenes_compra oc
        WHERE oc.rfq_id IS NOT NULL
      LOOP
        PERFORM public.f_verificar_cierre_requisicion(r.requisicion_id);
      END LOOP;
    END;
    $$;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
    -- Triggers
    DROP TRIGGER IF EXISTS trg_req_autocierre_from_oc ON public.ordenes_compra;
    DROP TRIGGER IF EXISTS trg_req_autocierre_from_ocd_recibido ON public.ordenes_compra_detalle;
    DROP TRIGGER IF EXISTS trg_req_autocierre_from_ocd_insdel ON public.ordenes_compra_detalle;
    DROP TRIGGER IF EXISTS trg_req_autocierre_from_opciones ON public.requisiciones_opciones;

    -- Trigger functions
    DROP FUNCTION IF EXISTS public.trg_requisicion_cierre_desde_oc();
    DROP FUNCTION IF EXISTS public.trg_requisicion_cierre_desde_ocd();
    DROP FUNCTION IF EXISTS public.trg_requisicion_cierre_desde_opciones();

    -- Main function
    DROP FUNCTION IF EXISTS public.f_verificar_cierre_requisicion(int);
  `);
};
