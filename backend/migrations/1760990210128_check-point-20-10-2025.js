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

   // 0) Extensión para UUIDs (sin riesgo si ya existe)
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  // 1) PROVEEDORES — columnas de notificación (idempotente)
  pgm.addColumns(
    { schema: 'public', name: 'proveedores' },
    {
      whatsapp_notificaciones: { type: 'varchar(30)', notNull: false },
      correo_notificaciones: { type: 'varchar(150)', notNull: false },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='proveedores' AND column_name='whatsapp_notificaciones'
      ) THEN
        COMMENT ON COLUMN public.proveedores.whatsapp_notificaciones
          IS 'Teléfono WhatsApp para notificaciones automatizadas';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='proveedores' AND column_name='correo_notificaciones'
      ) THEN
        COMMENT ON COLUMN public.proveedores.correo_notificaciones
          IS 'Correo alternativo para notificaciones';
      END IF;
    END$$;
  `);

  // 2) ORDENES_COMPRA — columnas + FK + índices (idempotente)
  pgm.addColumns(
    { schema: 'public', name: 'ordenes_compra' },
    {
      notificacion_proveedor_metodo_id: { type: 'integer', notNull: false },
      recoleccion_parcial: { type: 'boolean', notNull: true, default: false },
    },
    { ifNotExists: true }
  );

  // FK (si no existe)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'ordenes_compra'
          AND c.contype = 'f'
          AND c.conname = 'ordenes_compra_notificacion_proveedor_metodo_id_fkey'
      ) THEN
        ALTER TABLE public.ordenes_compra
          ADD CONSTRAINT ordenes_compra_notificacion_proveedor_metodo_id_fkey
          FOREIGN KEY (notificacion_proveedor_metodo_id)
          REFERENCES public.catalogo_metodos_notificacion(id);
      END IF;
    END$$;
  `);

  // Índices defensivos (si no existen)
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'notificacion_proveedor_metodo_id', {
    name: 'ordenes_compra_notificacion_proveedor_metodo_id_index',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'entrega_parcial', {
    name: 'ordenes_compra_entrega_parcial_index',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'con_incidencia', {
    name: 'ordenes_compra_con_incidencia_index',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'metodo_recoleccion_id', {
    name: 'ordenes_compra_metodo_recoleccion_id_index',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'paqueteria_id', {
    name: 'ordenes_compra_paqueteria_id_index',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'status', {
    name: 'idx_oc_status',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'usuario_id', {
    name: 'idx_oc_usuario',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'proyecto_id', {
    name: 'idx_oc_proyecto',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'rfq_id', {
    name: 'idx_oc_rfq',
    ifNotExists: true,
  });
  pgm.createIndex({ schema: 'public', name: 'ordenes_compra' }, 'sitio_id', {
    name: 'idx_oc_sitio',
    ifNotExists: true,
  });

  // 3) catalogo_paqueterias — agregar UNIQUE(nombre) si no hay duplicados
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'catalogo_paqueterias'
          AND c.contype = 'u'
          AND c.conname = 'catalogo_paqueterias_nombre_key'
      ) THEN
        IF EXISTS (
          SELECT nombre
          FROM public.catalogo_paqueterias
          GROUP BY nombre
          HAVING COUNT(*) > 1
        ) THEN
          RAISE NOTICE 'No se crea UNIQUE(nombre) en catalogo_paqueterias: hay duplicados. Limpia datos y reintenta.';
        ELSE
          ALTER TABLE public.catalogo_paqueterias
            ADD CONSTRAINT catalogo_paqueterias_nombre_key UNIQUE (nombre);
        END IF;
      END IF;
    END$$;
  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    // 1) ORDENES_COMPRA — quitar FK/índices/columnas añadidas
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'ordenes_compra'
          AND c.contype = 'f'
          AND c.conname = 'ordenes_compra_notificacion_proveedor_metodo_id_fkey'
      ) THEN
        ALTER TABLE public.ordenes_compra
          DROP CONSTRAINT ordenes_compra_notificacion_proveedor_metodo_id_fkey;
      END IF;
    END$$;
  `);

  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'notificacion_proveedor_metodo_id', {
    name: 'ordenes_compra_notificacion_proveedor_metodo_id_index',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'entrega_parcial', {
    name: 'ordenes_compra_entrega_parcial_index',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'con_incidencia', {
    name: 'ordenes_compra_con_incidencia_index',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'metodo_recoleccion_id', {
    name: 'ordenes_compra_metodo_recoleccion_id_index',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'paqueteria_id', {
    name: 'ordenes_compra_paqueteria_id_index',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'status', {
    name: 'idx_oc_status',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'usuario_id', {
    name: 'idx_oc_usuario',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'proyecto_id', {
    name: 'idx_oc_proyecto',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'rfq_id', {
    name: 'idx_oc_rfq',
    ifExists: true,
  });
  pgm.dropIndex({ schema: 'public', name: 'ordenes_compra' }, 'sitio_id', {
    name: 'idx_oc_sitio',
    ifExists: true,
  });

  // Quitar columnas añadidas
  pgm.dropColumns({ schema: 'public', name: 'ordenes_compra' }, ['notificacion_proveedor_metodo_id'], {
    ifExists: true,
  });
  pgm.dropColumns({ schema: 'public', name: 'ordenes_compra' }, ['recoleccion_parcial'], {
    ifExists: true,
  });

  // 2) PROVEEDORES — quitar columnas añadidas
  pgm.dropColumns({ schema: 'public', name: 'proveedores' }, ['whatsapp_notificaciones'], { ifExists: true });
  pgm.dropColumns({ schema: 'public', name: 'proveedores' }, ['correo_notificaciones'], { ifExists: true });

  // 3) catalogo_paqueterias — quitar UNIQUE(nombre) si fue agregado
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'catalogo_paqueterias'
          AND c.contype = 'u'
          AND c.conname = 'catalogo_paqueterias_nombre_key'
      ) THEN
        ALTER TABLE public.catalogo_paqueterias
          DROP CONSTRAINT catalogo_paqueterias_nombre_key;
      END IF;
    END$$;
  `);

  // 4) EXTENSIÓN uuid-ossp — normalmente NO la quitamos.
  // Si realmente quieres revertirla y no hay dependencias, descomenta:
  // pgm.sql(`DROP EXTENSION IF EXISTS "uuid-ossp";`);

};
