
/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
export const shorthands = undefined;
/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = async (pgm) => {
  await pgm.sql(`
    INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta)
    VALUES ('PICK_IN', 'Pick In', 'almacen', 'Warehouse', 'PICK_IN')
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      modulo = EXCLUDED.modulo,
      icono = EXCLUDED.icono,
      ruta = EXcluded.ruta;
  `);
};
/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = async (pgm) => {
  await pgm.sql(`DELETE FROM public.funciones WHERE codigo = 'PICK_IN';`);
};
