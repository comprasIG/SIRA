/**
 * ===============================================================================================
 * MIGRACIÓN: Permitir NULL en comprobante_link de pagos_oc
 * ===============================================================================================
 * El comprobante de pago es opcional cuando la fuente de pago es de tipo EFECTIVO.
 * La columna tenía una restricción NOT NULL que impedía registrar pagos en efectivo
 * sin subir un archivo a Drive.
 * ===============================================================================================
 */

exports.up = (pgm) => {
    pgm.alterColumn('pagos_oc', 'comprobante_link', {
        notNull: false,
    });
};

exports.down = (pgm) => {
    pgm.alterColumn('pagos_oc', 'comprobante_link', {
        notNull: true,
    });
};
