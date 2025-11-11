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
    // Usamos un bloque de SQL para poder declarar variables y hacer búsquedas
  pgm.sql(`
    DO $$
    DECLARE
      v_cliente_id INT;
      v_sitio_id INT;
      v_unidad_servicio_id INT;
      v_unidad_pieza_id INT;
      v_unidad_litro_id INT;
    BEGIN
      -- 1. Crear Unidades de Catálogo (Idempotente, como pediste)
      -- Creamos 'Servicio'
      INSERT INTO public.catalogo_unidades (unidad, simbolo, creado_en, actualizado_en)
      VALUES ('Servicio', 'serv', NOW(), NOW())
      ON CONFLICT (simbolo) DO NOTHING;

      -- 2. Buscar los IDs de las Unidades (Búsqueda por nombre/símbolo, como pediste)
      SELECT id INTO v_unidad_servicio_id FROM public.catalogo_unidades WHERE simbolo = 'serv';
      SELECT id INTO v_unidad_pieza_id FROM public.catalogo_unidades WHERE simbolo = 'PZ'; --
      SELECT id INTO v_unidad_litro_id FROM public.catalogo_unidades WHERE simbolo = 'L'; --

      -- 3. Crear el Sitio "Diferenciador" (Idempotente)
      -- Buscamos el cliente por 'razon_social' como pediste
      SELECT id INTO v_cliente_id FROM public.clientes WHERE razon_social = 'IG BIOGAS' LIMIT 1;

      IF v_cliente_id IS NOT NULL THEN
        INSERT INTO public.sitios (nombre, cliente, ubicacion, creado_en, actualizado_en)
        VALUES ('UNIDADES', v_cliente_id, 'OFICINAS IG BIOGAS GRANJA EL CHACHO AGS.', NOW(), NOW())
        ON CONFLICT (nombre) DO UPDATE SET ubicacion = EXCLUDED.ubicacion
        RETURNING id INTO v_sitio_id;
      ELSE
        RAISE WARNING 'Cliente "IG BIOGAS" no encontrado. El sitio "UNIDADES" no pudo ser creado.';
      END IF;

      -- 4. Poblar Catálogo de Materiales (Idempotente)
      -- Solo si las unidades se encontraron
      IF v_unidad_servicio_id IS NOT NULL AND v_unidad_pieza_id IS NOT NULL AND v_unidad_litro_id IS NOT NULL THEN
        INSERT INTO public.catalogo_materiales (tipo, categoria, detalle, sku, unidad_de_compra, ultimo_precio, activo)
        VALUES
          ('SERVICIO', 'MANTENIMIENTO', 'Servicio Preventivo Vehicular', 'SERV-VEH-PREV', v_unidad_servicio_id, '0', true),
          ('SERVICIO', 'MANTENIMIENTO', 'Servicio Correctivo Vehicular', 'SERV-VEH-CORR', v_unidad_servicio_id, '0', true),
          ('REFACCION', 'LLANTAS', 'Paquete Llantas (Genérico)', 'LLANTA-GEN', v_unidad_pieza_id, '0', true),
          ('GASTO', 'COMBUSTIBLE', 'Carga de Combustible', 'COMBUS-GEN', v_unidad_litro_id, '0', true)
        ON CONFLICT (nombre) DO NOTHING;
      ELSE
        RAISE WARNING 'No se pudieron encontrar los IDs de unidades (serv, PZ, L). Los materiales genéricos no fueron creados.';
      END IF;

      -- 5. Poblar Catálogo de Tipos de Evento (Idempotente)
      INSERT INTO public.unidades_evento_tipos (codigo, nombre, descripcion)
      VALUES
        ('SERVICIO_PREV', 'Servicio Preventivo', 'Mantenimiento programado (afinación, frenos, etc.)'),
        ('SERVICIO_CORR', 'Servicio Correctivo', 'Reparación por falla o avería.'),
        ('LLANTAS', 'Cambio de Llantas', 'Compra y/o instalación de llantas.'),
        ('COMBUSTIBLE', 'Carga de Combustible', 'Registro de carga de gasolina o diesel.'),
        ('INCIDENCIA', 'Reporte de Incidencia', 'Reporte de choque, robo o problema mayor.'),
        ('OTRO', 'Otro Gasto/Evento', 'Cualquier otro gasto o registro no catalogado.')
      ON CONFLICT (codigo) DO NOTHING;

    END $$;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // El 'down' es más complejo, pero por seguridad es mejor solo borrar
  // los tipos de evento, ya que los materiales y el sitio podrían estar en uso.
  pgm.sql(`DELETE FROM public.unidades_evento_tipos WHERE codigo IN (
    'SERVICIO_PREV', 'SERVICIO_CORR', 'LLANTAS', 'COMBUSTIBLE', 'INCIDENCIA', 'OTRO'
  );`);
};
