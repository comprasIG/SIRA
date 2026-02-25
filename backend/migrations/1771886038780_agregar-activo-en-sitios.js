/**
 * ===============================================================================================
 * MIGRACIÓN: Agregar campo activo a sitios
 * ===============================================================================================
 * Permite activar/desactivar sitios desde la pantalla /sitios.
 * Por defecto todos los sitios existentes quedan como activos (true).
 * ===============================================================================================
 */

exports.up = (pgm) => {
    pgm.addColumn('sitios', {
        activo: {
            type: 'boolean',
            notNull: true,
            default: true,
        },
    });

    pgm.sql(`
    COMMENT ON COLUMN public.sitios.activo
    IS 'Indica si el sitio está activo. Los sitios inactivos no aparecen en dropdowns de G_REQ.';
  `);
};

exports.down = (pgm) => {
    pgm.dropColumn('sitios', 'activo');
};
