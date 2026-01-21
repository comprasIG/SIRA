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
    WITH data(marca, razon_social, rfc, contacto, telefono, correo) AS (
      VALUES
        ('SOLDADURAS JM','ERIKA MEDINA ESPINOSA','MEEE821027R54','JULIO JURADO','449 109 3283','ventas@soldadurasjm.com'),
        ('CONEXIONES Y MANGUERAS HIDROCALIDAS','CONEXIONES Y MANGUERAS HIDROCALIDAS SA DE CV','CMH0906091S1','CLAUDIA DE LUNA','449 120 0055','parkerstore@cymh.com.mx'),
        ('RELY ON','RELYON NUTEC DE MEXICO SAPI DE CV','FSS091014GK7','ELISA WONG','938 104 7811','elisa.mar@relyon.com'),
        ('SEÑOR SEGURIDAD','EQUIPOS Y MATERIALES PARA EL TRABAJO SEGURO','EMT2007113SLO','MELY MACIAS','449 580 8880','maricarmen.m@srseguridad.com')
    )
    INSERT INTO proveedores (marca, razon_social, rfc, contacto, telefono, correo)
    SELECT d.marca, d.razon_social, d.rfc, d.contacto, d.telefono, d.correo
    FROM data d
    WHERE NOT EXISTS (
      SELECT 1 FROM proveedores p WHERE p.rfc = d.rfc
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
      pgm.sql(`
    DELETE FROM proveedores
    WHERE rfc IN ('MEEE821027R54','CMH0906091S1','FSS091014GK7','EMT2007113SLO');
  `);
};
