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
    INSERT INTO public.catalogo_unidades (id, unidad, simbolo) VALUES
        (2, 'kilogramo', 'kg'),
        (3, 'litro', 'L'),
        (4, 'galón', 'gal'),
        (5, 'kit', 'kit'),
        (6, 'metro', 'm'),
        (7, 'centímetro', 'cm'),
        (8, 'pieza', 'pz'),
        (9, 'caja', 'cja'),
        (1, 'servicio', 'serv')
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
        DELETE FROM public.catalogo_unidades WHERE id IN (2, 3, 4, 5, 6, 7, 8, 9, 1);
    `);
    
};
