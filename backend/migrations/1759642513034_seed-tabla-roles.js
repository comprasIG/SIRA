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
    INSERT INTO public.roles (id, codigo, nombre) VALUES
        (1, 'AUX', 'USUARIO DE REQUISICIONES'),
        (2, 'GERENTE', 'GERENTE DE DEPARTAMENTO'),
        (54, 'TI', 'SISTEMAS'),
        (3, 'FINANZAS', 'EQUIPO DE FINANZAS'),
        (4, 'CFO', 'DIRECTOR FINANCIERO'),
        (5, 'ALMACEN', 'EQUIPO DE ALMACEN'),
        (32, 'COMPRADOR', 'COMPRADOR'),
        (33, 'G_COMPRAS', 'GERENTE DE COMPRAS'),
        (34, 'LOGISTICA', 'LOGISTICA'),
        (35, 'CONTABILIDAD', 'CONTABILIDAD')
    ON CONFLICT (id) DO NOTHING;
  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     pgm.sql(`
        DELETE FROM public.roles WHERE id IN (1, 2, 54, 3, 4, 5, 32, 33, 34, 35);
    `);
};
