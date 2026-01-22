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
  pgm.sql(`
    INSERT INTO public.proveedores
      (marca, razon_social, rfc, contacto, telefono, correo)
    VALUES
      ('HEALTH & SAFETY', 'HEALTH & SAFETY DE MEXICO', 'H&S000515QF3', 'JAVIER CÁRDENAS', '449 273 3336', 'ventas10.ecologicsm@gmail.com'),
      ('AWITE', 'AWITE BIOENERGIE GMBH', 'DE248817173', 'Martin Grepmeier', '+49 8761 72162-30', 'service@awite.de')
    ON CONFLICT (rfc) DO UPDATE SET
      marca = EXCLUDED.marca,
      razon_social = EXCLUDED.razon_social,
      contacto = EXCLUDED.contacto,
      telefono = EXCLUDED.telefono,
      correo = EXCLUDED.correo,
      actualizado_en = now();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.sql(`
    DELETE FROM public.proveedores
    WHERE rfc IN ('H&S000515QF3', 'DE248817173');
  `);
};
