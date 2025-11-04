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

    // --- Cambios en inventario_actual ---
  pgm.addColumn('inventario_actual', {
    ultimo_precio_entrada: {
      type: 'numeric(14, 4)',
      default: 0,
      comment: 'Último costo unitario registrado al ingresar a STOCK este material en esta ubicación.',
    },
    moneda: { // Columna para la moneda del último precio
      type: 'bpchar(3)', // 3 caracteres fijos, como en catalogo_monedas
      references: '"catalogo_monedas"', // Clave foránea
      onDelete: 'SET NULL', // O 'RESTRICT' si prefieres no permitir borrar monedas en uso
      comment: 'Moneda del ultimo_precio_entrada.',
    },
  }, { ifNotExists: true });

  // --- Cambios en inventario_asignado ---
  pgm.addColumn('inventario_asignado', {
    moneda: { // Columna para la moneda del valor unitario
      type: 'bpchar(3)',
      references: '"catalogo_monedas"',
      onDelete: 'SET NULL', // O 'RESTRICT'
      comment: 'Moneda del valor_unitario de esta asignación.',
    },
  }, { ifNotExists: true });

  // --- Cambios en movimientos_inventario ---
  pgm.addColumn('movimientos_inventario', {
    valor_unitario: {
      type: 'numeric(14, 4)',
      default: 0,
      comment: 'Costo/Valor unitario del material en este movimiento.',
    },
    valor_total: {
      type: 'numeric(14, 4)',
      default: 0,
      comment: 'Valor total del movimiento (cantidad * valor_unitario).',
    },
    // Añadimos moneda también aquí para consistencia
    moneda: {
        type: 'bpchar(3)',
        references: '"catalogo_monedas"',
        onDelete: 'SET NULL', // O 'RESTRICT'
        comment: 'Moneda del valor_unitario en este movimiento.',
    },
  }, { ifNotExists: true });

  // --- Trigger para calcular valor_total en movimientos_inventario ---
  pgm.sql(`
    CREATE OR REPLACE FUNCTION f_calcular_valor_total_movimiento()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Solo calcula si valor_unitario y cantidad están presentes
        IF NEW.cantidad IS NOT NULL AND NEW.valor_unitario IS NOT NULL THEN
            NEW.valor_total := NEW.cantidad * NEW.valor_unitario;
        ELSE
            NEW.valor_total := 0; -- O NULL si prefieres
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Asegurarse de que el trigger no exista antes de crearlo
  pgm.sql(`DROP TRIGGER IF EXISTS trg_calcular_valor_total_movimiento ON movimientos_inventario;`);
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

  // Eliminar columnas (en orden inverso a la creación)
  pgm.dropColumn('movimientos_inventario', 'moneda', { ifExists: true });
  pgm.dropColumn('movimientos_inventario', 'valor_total', { ifExists: true });
  pgm.dropColumn('movimientos_inventario', 'valor_unitario', { ifExists: true });
  pgm.dropColumn('inventario_asignado', 'moneda', { ifExists: true });
  pgm.dropColumn('inventario_actual', 'moneda', { ifExists: true });
  pgm.dropColumn('inventario_actual', 'ultimo_precio_entrada', { ifExists: true });
};