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
        INSERT INTO public.rol_funcion (rol_id, funcion_id) VALUES
  (1,1),
  (2,1),
  (3,1),
  (2,2),
  (32,3),
  (33,3),
  (34,3),
  (33,4),
  (34,4),
  (32,5),
  (33,5),
  (34,5),
  (33,6),
  (34,6),
  (4,7),
  (35,7),
  (32,8),
  (33,8),
  (34,8),
  (5,9),
  (33,9),
  (34,9)
ON CONFLICT (rol_id, funcion_id) DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {};
