// backend/migrations/XXXXXXXXXXXX_rfq_borradores_compartido_por_requisicion.js
/**
 * ===============================================================================================
 * MIGRACIÓN: RFQ borradores compartidos por requisición (no por usuario)
 * ===============================================================================================
 * Contexto:
 * - Antes: rfq_borradores tenía PK (requisicion_id, usuario_id) => un borrador por usuario.
 * - Ahora: queremos 1 borrador por requisición (compartido), para que cualquier usuario vea
 *   el mismo autosave y el flujo sea colaborativo.
 *
 * Estrategia:
 * 1) Deduplicar por requisicion_id conservando el registro más reciente (actualizado_en).
 * 2) Agregar columna actualizado_por_usuario_id para auditoría.
 * 3) Migrar usuario_id -> actualizado_por_usuario_id.
 * 4) Quitar usuario_id y su FK.
 * 5) Cambiar PK a solo requisicion_id.
 * 6) Crear FK actualizado_por_usuario_id -> usuarios(id) ON DELETE SET NULL.
 *
 * Nota importante:
 * - El DOWN NO puede reconstruir registros deduplicados (no hay forma de saber cuáles eran).
 *   El DOWN restaura la estructura anterior, pero con un solo registro por requisición.
 * ===============================================================================================
 */

exports.up = (pgm) => {
  // ---------------------------------------------------------------------------------------------
  // 0) Guardas de seguridad
  // ---------------------------------------------------------------------------------------------
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'rfq_borradores'
      ) THEN
        RAISE EXCEPTION 'La tabla public.rfq_borradores no existe. Aborta migración.';
      END IF;
    END $$;
  `);

  // ---------------------------------------------------------------------------------------------
  // 1) Deduplicación: quedarnos con 1 registro por requisicion_id (el más reciente)
  // ---------------------------------------------------------------------------------------------
  pgm.sql(`
    CREATE TEMP TABLE _rfq_borradores_latest AS
    SELECT DISTINCT ON (requisicion_id)
      requisicion_id,
      usuario_id,
      "data",
      actualizado_en
    FROM public.rfq_borradores
    ORDER BY requisicion_id, actualizado_en DESC;

    TRUNCATE TABLE public.rfq_borradores;

    INSERT INTO public.rfq_borradores (requisicion_id, usuario_id, "data", actualizado_en)
    SELECT requisicion_id, usuario_id, "data", actualizado_en
    FROM _rfq_borradores_latest;

    DROP TABLE _rfq_borradores_latest;
  `);

  // ---------------------------------------------------------------------------------------------
  // 2) Agregar columna de auditoría y migrar valor desde usuario_id
  // ---------------------------------------------------------------------------------------------
  pgm.addColumn('rfq_borradores', {
    actualizado_por_usuario_id: { type: 'int4', notNull: false },
  });

  pgm.sql(`
    UPDATE public.rfq_borradores
    SET actualizado_por_usuario_id = usuario_id
    WHERE actualizado_por_usuario_id IS NULL;
  `);

  // ---------------------------------------------------------------------------------------------
  // 3) Eliminar constraints previos (PK y FK de usuario_id)
  //    (Los nombres vienen de tu DDL; usamos IF EXISTS para robustez.)
  // ---------------------------------------------------------------------------------------------
  pgm.sql(`ALTER TABLE public.rfq_borradores DROP CONSTRAINT IF EXISTS rfq_borradores_pkey;`);
  pgm.sql(`ALTER TABLE public.rfq_borradores DROP CONSTRAINT IF EXISTS rfq_borradores_usuario_id_fkey;`);

  // ---------------------------------------------------------------------------------------------
  // 4) Eliminar columna usuario_id (ya migrada a actualizado_por_usuario_id)
  // ---------------------------------------------------------------------------------------------
  pgm.dropColumn('rfq_borradores', 'usuario_id');

  // ---------------------------------------------------------------------------------------------
  // 5) Crear nueva PK: solo requisicion_id
  // ---------------------------------------------------------------------------------------------
  pgm.addConstraint('rfq_borradores', 'rfq_borradores_pkey', {
    primaryKey: ['requisicion_id'],
  });

  // ---------------------------------------------------------------------------------------------
  // 6) Crear nueva FK para auditoría: actualizado_por_usuario_id -> usuarios(id)
  // ---------------------------------------------------------------------------------------------
  pgm.addConstraint('rfq_borradores', 'rfq_borradores_actualizado_por_usuario_id_fkey', {
    foreignKeys: [
      {
        columns: 'actualizado_por_usuario_id',
        references: 'usuarios(id)',
        onDelete: 'SET NULL',
      },
    ],
  });
};

exports.down = (pgm) => {
  // ---------------------------------------------------------------------------------------------
  // DOWN (estructural): vuelve a (requisicion_id, usuario_id)
  // NOTA: no reconstruye duplicados previos. Deja un registro por requisición.
  // ---------------------------------------------------------------------------------------------

  // 1) Quitar PK actual y FK de auditoría
  pgm.sql(`ALTER TABLE public.rfq_borradores DROP CONSTRAINT IF EXISTS rfq_borradores_pkey;`);
  pgm.sql(`ALTER TABLE public.rfq_borradores DROP CONSTRAINT IF EXISTS rfq_borradores_actualizado_por_usuario_id_fkey;`);

  // 2) Re-crear columna usuario_id (nullable temporalmente para evitar fallos)
  pgm.addColumn('rfq_borradores', {
    usuario_id: { type: 'int4', notNull: false },
  });

  // 3) Volcar auditoría a usuario_id (si existe)
  pgm.sql(`
    UPDATE public.rfq_borradores
    SET usuario_id = actualizado_por_usuario_id
    WHERE usuario_id IS NULL;
  `);

  // 4) Restaurar FK usuario_id -> usuarios(id)
  pgm.addConstraint('rfq_borradores', 'rfq_borradores_usuario_id_fkey', {
    foreignKeys: [
      {
        columns: 'usuario_id',
        references: 'usuarios(id)',
        onDelete: 'CASCADE',
      },
    ],
  });

  // 5) Restaurar PK compuesta
  pgm.addConstraint('rfq_borradores', 'rfq_borradores_pkey', {
    primaryKey: ['requisicion_id', 'usuario_id'],
  });

  // 6) Quitar columna de auditoría
  pgm.dropColumn('rfq_borradores', 'actualizado_por_usuario_id');
};
