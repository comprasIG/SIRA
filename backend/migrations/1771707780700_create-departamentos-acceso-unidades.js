/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // 1. Crear tabla (Si no existe)
  pgm.createTable('departamentos_acceso_unidades', {
    departamento_id: { type: 'integer', notNull: true, primaryKey: true, references: '"departamentos"', onDelete: 'CASCADE' },
    puede_ver_todo: { type: 'boolean', notNull: true, default: false },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  }, { ifNotExists: true }); // <--- IDEMPOTENTE

  // 2. Comentarios
  pgm.sql(`
    COMMENT ON TABLE public.departamentos_acceso_unidades IS 'Configura qué departamentos pueden ver TODAS las unidades de la flotilla, sin importar el responsable';
    COMMENT ON COLUMN public.departamentos_acceso_unidades.puede_ver_todo IS 'Si true, usuarios de este departamento ven todas las unidades (equivalente al antiguo hardcode FIN/SSD)';
  `);

  // 3. Crear Función (replace: true lo hace idempotente)
  pgm.createFunction('fn_dau_update_timestamp', [], { returns: 'trigger', language: 'plpgsql', replace: true },
    `BEGIN NEW.actualizado_en = now(); RETURN NEW; END;`
  );

  // 4. Trigger (Borrar primero para evitar error de "ya existe")
  pgm.dropTrigger('departamentos_acceso_unidades', 'trg_dau_update', { ifExists: true });
  pgm.createTrigger('departamentos_acceso_unidades', 'trg_dau_update', {
    when: 'BEFORE', operation: 'UPDATE', level: 'ROW', function: 'fn_dau_update_timestamp',
  });

  // 5. Permisos y Seed (Idempotentes)
  pgm.sql(`
    GRANT ALL ON TABLE public.departamentos_acceso_unidades TO sira_stg_user;
    GRANT UPDATE, DELETE, SELECT, INSERT ON TABLE public.departamentos_acceso_unidades TO sira_prod_user;

    INSERT INTO public.departamentos_acceso_unidades (departamento_id, puede_ver_todo)
    SELECT id, true FROM public.departamentos WHERE codigo IN ('FIN', 'SSD')
    ON CONFLICT (departamento_id) DO UPDATE SET puede_ver_todo = EXCLUDED.puede_ver_todo;
  `);
};

export const down = (pgm) => {
  pgm.dropTrigger('departamentos_acceso_unidades', 'trg_dau_update', { ifExists: true });
  pgm.dropFunction('fn_dau_update_timestamp', [], { ifExists: true });
  pgm.dropTable('departamentos_acceso_unidades', { ifExists: true });
};