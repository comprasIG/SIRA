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
    // Eliminar el trigger si existe
  pgm.sql(`DROP TRIGGER IF EXISTS trg_procesar_recepcion_oc ON public.recepciones_oc;`);
  // Eliminar la función si existe
  pgm.sql(`DROP FUNCTION IF EXISTS public.f_procesar_recepcion_oc();`);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // --- IMPORTANTE: Recrear la función y el trigger originales en el 'down' ---
  // ---             Copiado del DDL original para asegurar consistencia      ---

  // 1. Recrear la función
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.f_procesar_recepcion_oc()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      inv_id INTEGER;
      id_proyecto_stock INTEGER;
      oc_record RECORD;
    BEGIN
      -- Obtener el ID del proyecto "STOCK ALMACEN"
      SELECT id INTO id_proyecto_stock
      FROM public.proyectos
      WHERE nombre = 'STOCK ALMACEN'
      LIMIT 1;
      -- Si no se encuentra el proyecto de stock, lanzar un error
      IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el proyecto "STOCK ALMACEN". Por favor, créelo antes de continuar.';
      END IF;

      -- Obtener sitio y proyecto desde la OC
      SELECT sitio_id, proyecto_id INTO oc_record
      FROM public.ordenes_compra
      WHERE id = NEW.orden_compra_id;
      -- Buscar o crear registro en inventario_actual
      SELECT id INTO inv_id
      FROM public.inventario_actual
      WHERE material_id = NEW.material_id AND ubicacion_id = oc_record.sitio_id;
      IF NOT FOUND THEN
        INSERT INTO public.inventario_actual (material_id, ubicacion_id)
        VALUES (NEW.material_id, oc_record.sitio_id)
        RETURNING id INTO inv_id;
      END IF;

      -- Decidir si es para stock o para asignación
      IF oc_record.proyecto_id = id_proyecto_stock THEN
        UPDATE public.inventario_actual
        SET stock_actual = stock_actual + NEW.cantidad
        WHERE id = inv_id;
      ELSE
        UPDATE public.inventario_actual
        SET asignado = asignado + NEW.cantidad
        WHERE id = inv_id;
        INSERT INTO public.inventario_asignado (
          inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario
        ) VALUES (
          inv_id, NEW.requisicion_detalle_id, oc_record.proyecto_id, oc_record.sitio_id,
          NEW.cantidad, NEW.valor_unitario
        );
      END IF;

      RETURN NEW;
    END;
    $function$;
  `);

  // 2. Recrear el trigger
  pgm.sql(`
    CREATE TRIGGER trg_procesar_recepcion_oc
    AFTER INSERT ON public.recepciones_oc
    FOR EACH ROW
    EXECUTE FUNCTION public.f_procesar_recepcion_oc();
  `);
  
};
