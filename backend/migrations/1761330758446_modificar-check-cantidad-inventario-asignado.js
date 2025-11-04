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
    // 1. Eliminar la restricción existente (si existe)
  pgm.dropConstraint('inventario_asignado', 'inventario_asignado_cantidad_check', { ifExists: true });

  // 2. Añadir la nueva restricción permitiendo cero
  pgm.addConstraint('inventario_asignado', 'inventario_asignado_cantidad_check', {
    check: 'cantidad >= 0', // Permite que la cantidad sea 0 o mayor
  });

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    // Revertir: eliminar la restricción que permite cero
  pgm.dropConstraint('inventario_asignado', 'inventario_asignado_cantidad_check', { ifExists: true });

  // Revertir: volver a añadir la restricción original que exige > 0
  pgm.addConstraint('inventario_asignado', 'inventario_asignado_cantidad_check', {
    check: 'cantidad > 0', // Vuelve a la restricción original
  });
};
