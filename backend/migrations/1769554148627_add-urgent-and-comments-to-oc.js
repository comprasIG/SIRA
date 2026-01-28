/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * =================================================================================================
 * MIGRATION: Add Operational Fields to Purchase Order
 * =================================================================================================
 * Description:
 * Adds flags for urgency and financial comments to the 'ordenes_compra' table.
 * These fields improve communication between Procurement and Finance.
 * * - es_urgente: Boolean flag to highlight priority.
 * - comentarios_finanzas: Text field for specific payment instructions (e.g., "Pay in cash").
 * =================================================================================================
 */

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // We use IF NOT EXISTS logic implicitly by checking columns or using safe add
    pgm.addColumns('ordenes_compra', {
        es_urgente: {
            type: 'boolean',
            notNull: true,
            default: false,
            comment: 'Indicates if the Purchase Order requires immediate attention by Finance.'
        },
        comentarios_finanzas: {
            type: 'text',
            notNull: false,
            comment: 'Specific instructions for the Finance department (e.g., payment method).'
        }
    }, {
        ifNotExists: true // SAFE GUARD: This prevents errors if you already ran it.
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropColumns('ordenes_compra', ['es_urgente', 'comentarios_finanzas'], {
        ifExists: true
    });
};
