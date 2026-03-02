/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
// Esta migración crea triggers para actualizar automáticamente el campo 'actualizado_en' en las tablas de empresas, áreas, puestos, departamentos de recursos humanos y status de trabajadores cada vez que se realice una actualización.
exports.up = (pgm) => {
  // 1. Crear la función que actualiza el campo 'actualizado_en'
  pgm.createFunction(
    'actualizar_fecha_modificacion',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.actualizado_en = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    `
  );

  // 2. Definir las tablas que necesitan el trigger
  const tablas = ['empresas', 'areas', 'puestos', 'departamentos_rh', 'status_trabajador'];

  // 3. Crear un trigger para cada tabla
  tablas.forEach((tabla) => {
    pgm.createTrigger(tabla, `tr_actualizar_fecha_${tabla}`, {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'actualizar_fecha_modificacion',
    });
  });
};

exports.down = (pgm) => {
  const tablas = ['empresas', 'areas', 'puestos', 'departamentos_rh', 'status_trabajador'];

  tablas.forEach((tabla) => {
    pgm.dropTrigger(tabla, `tr_actualizar_fecha_${tabla}`);
  });

  pgm.dropFunction('actualizar_fecha_modificacion', []);
};