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

    // Define the locations to insert
  const ubicaciones = [
    { codigo: 'EST-A1', nombre: 'Estante A - Nivel 1', descripcion: 'Estantería metálica A, primer nivel.' },
    { codigo: 'EST-A2', nombre: 'Estante A - Nivel 2', descripcion: 'Estantería metálica A, segundo nivel.' },
    { codigo: 'RACK-B1', nombre: 'Rack B - Nivel 1', descripcion: 'Rack de carga B, nivel inferior.' },
    { codigo: 'PISO-C', nombre: 'Piso - Zona C', descripcion: 'Área designada en piso, sección C.' },
    { codigo: 'PISO_EXT', nombre: 'Piso Exterior', descripcion: 'Área exterior designada para materiales resistentes.' },
    { codigo: 'PATIO', nombre: 'Patio', descripcion: 'Zona general del patio.' },
  ];

  // Build the SQL INSERT statement with ON CONFLICT DO NOTHING for idempotency
  // This ensures that if a location with the same 'codigo' already exists, it won't try to insert it again.
  const values = ubicaciones.map(u => `('${u.codigo}', '${u.nombre}', ${u.descripcion ? `'${u.descripcion}'` : 'NULL'})`).join(',\n');

  pgm.sql(`
    INSERT INTO ubicaciones_almacen (codigo, nombre, descripcion) VALUES
    ${values}
    ON CONFLICT (codigo) DO NOTHING;
  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    // Define the codes of the locations inserted by this seed
  const codigos = ['EST-A1', 'EST-A2', 'RACK-B1', 'PISO-C', 'PISO_EXT', 'PATIO'];

  // Delete only the locations added by this migration
  pgm.sql(`
    DELETE FROM ubicaciones_almacen
    WHERE codigo IN (${codigos.map(c => `'${c}'`).join(',')});
  `);
};
