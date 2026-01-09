/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

// ✅ Defaults para la ubicación "SIN UBICACIÓN"
const CODIGO_DEFAULT = "SIN_UBICACION";
const NOMBRE_DEFAULT = "SIN UBICACIÓN";

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO public.ubicaciones_almacen (codigo, nombre)
    SELECT '${CODIGO_DEFAULT}', '${NOMBRE_DEFAULT}'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.ubicaciones_almacen
      WHERE upper(codigo) = upper('${CODIGO_DEFAULT}')
         OR upper(nombre) IN ('SIN UBICACIÓN', 'SIN UBICACION', 'SIN_UBICACION')
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Down “seguro”: solo borra si NO está referenciada.
  pgm.sql(`
    DO $$
    DECLARE
      v_id integer;
      v_ref_count integer;
    BEGIN
      SELECT id INTO v_id
      FROM public.ubicaciones_almacen
      WHERE upper(codigo) = upper('${CODIGO_DEFAULT}')
         OR upper(nombre) IN ('SIN UBICACIÓN', 'SIN UBICACION', 'SIN_UBICACION')
      ORDER BY id ASC
      LIMIT 1;

      IF v_id IS NULL THEN
        RETURN;
      END IF;

      SELECT
        COALESCE((SELECT COUNT(*) FROM public.inventario_actual WHERE ubicacion_id = v_id), 0)
        +
        COALESCE((SELECT COUNT(*) FROM public.movimientos_inventario WHERE ubicacion_id = v_id), 0)
      INTO v_ref_count;

      IF v_ref_count = 0 THEN
        DELETE FROM public.ubicaciones_almacen
        WHERE id = v_id;
      END IF;
    END $$;
  `);
};
