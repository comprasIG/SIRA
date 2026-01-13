/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
// 1. Crear ENUM para estatus de pago (Semáforo Financiero)
    pgm.sql(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estatus_pago_enum') THEN
                CREATE TYPE public.estatus_pago_enum AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO');
            END IF;
        END $$;
    `);

    // 2. Agregar columna estatus_pago a ordenes_compra
    pgm.sql(`
        ALTER TABLE public.ordenes_compra
        ADD COLUMN IF NOT EXISTS estatus_pago public.estatus_pago_enum DEFAULT 'PENDIENTE' NOT NULL;
    `);

    // 3. Inicializar estatus_pago basado en la data existente
    // Si ya no tiene pendiente_liquidar, asumimos que está PAGADO.
    pgm.sql(`
        UPDATE public.ordenes_compra
        SET estatus_pago = 'PAGADO'
        WHERE pendiente_liquidar = false;
    `);

    // 4. Agregar drive_folder_id a requisiciones (El ancla para tus archivos)
    pgm.sql(`
        ALTER TABLE public.requisiciones
        ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255) NULL;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
// Revertir cambios
    pgm.sql(`
        ALTER TABLE public.requisiciones DROP COLUMN IF EXISTS drive_folder_id;
        ALTER TABLE public.ordenes_compra DROP COLUMN IF EXISTS estatus_pago;
        DROP TYPE IF EXISTS public.estatus_pago_enum;
    `);
};
