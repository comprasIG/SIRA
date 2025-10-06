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
    INSERT INTO public.catalogo_monedas (codigo, nombre) VALUES
        ('MXN', 'Peso Mexicano'),
        ('USD', 'Dólar Estadounidense'),
        ('EUR', 'Euro'),
        ('GBP', 'Libra Esterlina')
    ON CONFLICT (codigo) DO NOTHING;
  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     pgm.sql(`
        DELETE FROM public.catalogo_monedas WHERE codigo IN ('MXN', 'USD', 'EUR', 'GBP');
    `);
};
