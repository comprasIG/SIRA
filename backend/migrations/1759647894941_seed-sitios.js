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
        INSERT INTO public.sitios (nombre, cliente, ubicacion) VALUES
  ('Ixtles', 1, 'Av. Principal 123'),
  ('Churintzio', 1, 'Av. Principal 123'),
  ('Tetillas', 1, 'Av. Principal 123'),
  ('Sabropollo Rastro', 2, 'Julio Díaz Torre 104 A, Ciudad Industrial'),
  ('Sabropollo Alimentos', 2, 'Julio Díaz Torre 104 A, Ciudad Industrial'),
  ('ALMACÉN IG', 3, 'OFICINAS IG BIOGAS GRANJA EL CHACHO AGS.')
ON CONFLICT (nombre) DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {};
