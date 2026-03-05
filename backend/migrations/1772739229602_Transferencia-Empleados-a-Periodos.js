/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/* eslint-disable camelcase */

/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO periodos_laborales (
        empleado_id, 
        empresa_id, 
        area_id, 
        departamento_rh_id, 
        puesto_id, 
        status_trabajador_id, 
        fecha_ingreso,
        motivo_baja,      -- Columna 8
        creado_en,        -- Columna 9
        actualizado_en    -- Columna 10 (Agregué esta para que coincida con tu tabla)
    )
    SELECT 
        id, 
        empresa_id, 
        area_id, 
        departamento_rh_id, 
        puesto_id, 
        status_trabajador_id, 
        COALESCE(fecha_ingreso, created_at::date, CURRENT_DATE),
        'Migración de sistema anterior', -- Valor para motivo_baja
        created_at, 
        updated_at
    FROM empleados;
  `);
};

exports.down = (pgm) => {
  // Limpia solo lo que insertamos en esta migración
  pgm.sql("DELETE FROM periodos_laborales WHERE motivo_baja = 'Migración de sistema anterior'");
};