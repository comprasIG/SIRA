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
    pgm.addColumns('unidades', {
    km_proximo_servicio: { type: 'integer' },
    rendimiento_teorico: { type: 'numeric(5, 2)' }, // Ej: 12.50
    tipo_combustible: { type: 'varchar(50)' }, // Ej: 'Magna', 'Diesel'
    tipo_bateria: { type: 'varchar(50)' }, // Ej: 'LHT-47-500'
    medidas_llantas: { type: 'varchar(50)' }, // Ej: '205/55 R16'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('unidades', [
    'km_proximo_servicio',
    'rendimiento_teorico',
    'tipo_combustible',
    'tipo_bateria',
    'medidas_llantas',
  ]);
};
