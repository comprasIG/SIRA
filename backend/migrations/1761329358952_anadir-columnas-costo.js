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

    pgm.addColumn('inventario_actual', {
    ultimo_precio_entrada: {
      type: 'numeric(14, 4)', // Mismo tipo que precio_unitario en detalle OC
      default: 0,
      comment: 'Último costo unitario registrado al ingresar a STOCK este material en esta ubicación.',
    },
  }, { ifNotExists: true });

  // Columnas para valor en movimientos_inventario
  pgm.addColumn('movimientos_inventario', {
    valor_unitario: {
      type: 'numeric(14, 4)',
      default: 0,
      comment: 'Costo/Valor unitario del material en este movimiento (último costo para salidas de stock, costo de OC para asignados).',
    },
    valor_total: {
      type: 'numeric(14, 4)',
      default: 0,
      comment: 'Valor total del movimiento (cantidad * valor_unitario).',
    },
  }, { ifNotExists: true });

  // Opcional: Trigger simple para calcular valor_total automáticamente
  // Podríamos hacerlo en el backend, pero un trigger es más robusto a cambios
  pgm.sql(`
    CREATE OR REPLACE FUNCTION f_calcular_valor_total_movimiento()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.valor_total := NEW.cantidad * NEW.valor_unitario;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_calcular_valor_total_movimiento
    BEFORE INSERT OR UPDATE ON movimientos_inventario
    FOR EACH ROW
    EXECUTE FUNCTION f_calcular_valor_total_movimiento();
  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    // Eliminar trigger y función
  pgm.sql(`DROP TRIGGER IF EXISTS trg_calcular_valor_total_movimiento ON movimientos_inventario;`);
  pgm.sql(`DROP FUNCTION IF EXISTS f_calcular_valor_total_movimiento();`);

  // Eliminar columnas
  pgm.dropColumn('movimientos_inventario', 'valor_total', { ifExists: true });
  pgm.dropColumn('movimientos_inventario', 'valor_unitario', { ifExists: true });
  pgm.dropColumn('inventario_actual', 'ultimo_precio_entrada', { ifExists: true });

};
