/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // 1. Agregar nuevas columnas (Con protección si ya existen)
  pgm.addColumns('unidades_evento_tipos', {
    genera_requisicion: { type: 'boolean', notNull: true, default: false },
    requiere_num_serie: { type: 'boolean', notNull: true, default: false },
    km_intervalo: { type: 'integer', default: null },
    tipo_combustible_aplica: { type: 'varchar(50)', default: null },
    material_sku: { type: 'varchar(50)', default: null },
  }, { ifNotExists: true }); // <--- ESTO LO HACE IDEMPOTENTE

  // 2. Comentarios (Seguros de ejecutar múltiples veces)
  pgm.sql(`
    COMMENT ON COLUMN public.unidades_evento_tipos.genera_requisicion IS 'Si true, este evento crea una requisición de compra en lugar de un registro manual';
    COMMENT ON COLUMN public.unidades_evento_tipos.requiere_num_serie IS 'Si true, el formulario exigirá ingresar número de serie';
    COMMENT ON COLUMN public.unidades_evento_tipos.km_intervalo IS 'Kilometraje de duración del servicio. El sistema notifica cuando km_actual >= km_ultimo_servicio + km_intervalo';
    COMMENT ON COLUMN public.unidades_evento_tipos.tipo_combustible_aplica IS 'Si se especifica, este tipo de servicio solo aparece para unidades con ese tipo de combustible. NULL = aplica a todos';
    COMMENT ON COLUMN public.unidades_evento_tipos.material_sku IS 'SKU del catálogo de materiales que se usará al generar la requisición para este tipo de evento';
  `);

  // 3. Actualizar datos existentes (Los UPDATE son idempotentes por naturaleza)
  pgm.sql(`
    UPDATE public.unidades_evento_tipos SET genera_requisicion = true, material_sku = 'SERV-VEH-PREV', tipo_combustible_aplica = 'GASOLINA' WHERE codigo = 'SERVICIO_PREV';
    UPDATE public.unidades_evento_tipos SET genera_requisicion = true, material_sku = 'SERV-VEH-CORR', tipo_combustible_aplica = 'GASOLINA' WHERE codigo = 'SERVICIO_CORR';
    UPDATE public.unidades_evento_tipos SET genera_requisicion = true, material_sku = 'LLANTA-GEN', requiere_num_serie = true WHERE codigo = 'LLANTAS';
  `);

  // 4. Insertar servicio Diesel (ON CONFLICT lo hace idempotente)
  pgm.sql(`
    INSERT INTO public.unidades_evento_tipos (codigo, nombre, descripcion, genera_requisicion, tipo_combustible_aplica, material_sku)
    VALUES ('SERVICIO_DIESEL', 'Servicio Diesel', 'Mantenimiento para unidades con motor diesel', true, 'DIESEL', 'SERV-VEH-PREV')
    ON CONFLICT (codigo) DO UPDATE SET
      genera_requisicion = EXCLUDED.genera_requisicion,
      tipo_combustible_aplica = EXCLUDED.tipo_combustible_aplica,
      material_sku = EXCLUDED.material_sku;
  `);

  // 5. Asegurar tipos manuales
  pgm.sql(`UPDATE public.unidades_evento_tipos SET genera_requisicion = false WHERE codigo IN ('INCIDENCIA', 'OTRO', 'COMBUSTIBLE');`);
};

export const down = (pgm) => {
  pgm.dropColumns('unidades_evento_tipos', ['genera_requisicion', 'requiere_num_serie', 'km_intervalo', 'tipo_combustible_aplica', 'material_sku'], { ifExists: true });
};