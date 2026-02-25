/**
 * ===============================================================================================
 * MIGRACIÓN: Agregar campo agregado_por_usuario_id a requisiciones_detalle
 * ===============================================================================================
 * Permite rastrear qué usuario de compras agregó un material adicional
 * desde la pantalla G_RFQ. Los materiales originales de la requisición
 * tendrán este campo en NULL.
 * ===============================================================================================
 */

exports.up = (pgm) => {
    // 1) Agregar columna nullable para no afectar registros existentes
    pgm.addColumn('requisiciones_detalle', {
        agregado_por_usuario_id: {
            type: 'int4',
            notNull: false,
            default: null,
        },
    });

    // 2) FK hacia usuarios(id) con ON DELETE SET NULL
    pgm.addConstraint(
        'requisiciones_detalle',
        'requisiciones_detalle_agregado_por_usuario_id_fkey',
        {
            foreignKeys: [
                {
                    columns: 'agregado_por_usuario_id',
                    references: 'usuarios(id)',
                    onDelete: 'SET NULL',
                },
            ],
        }
    );

    // 3) Comentario descriptivo
    pgm.sql(`
    COMMENT ON COLUMN public.requisiciones_detalle.agregado_por_usuario_id
    IS 'ID del usuario de compras que agregó este material adicional desde G_RFQ. NULL para materiales de la requisición original.';
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    ALTER TABLE public.requisiciones_detalle
    DROP CONSTRAINT IF EXISTS requisiciones_detalle_agregado_por_usuario_id_fkey;
  `);
    pgm.dropColumn('requisiciones_detalle', 'agregado_por_usuario_id');
};
