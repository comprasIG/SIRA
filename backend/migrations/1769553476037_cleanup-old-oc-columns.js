/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // We use ifExists: true to prevent errors if they were already deleted manually.
    pgm.dropColumns('ordenes_compra', ['oc_nota', 'oc_urgente'], {
        ifExists: true
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    // If we rollback, we restore them to avoid data loss during development testing.
    pgm.addColumns('ordenes_compra', {
        oc_urgente: {
            type: 'boolean',
            default: false
        },
        oc_nota: {
            type: 'text'
        }
    });
};
