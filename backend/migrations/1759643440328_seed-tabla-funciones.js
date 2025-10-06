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
    pgm.sql(`
        INSERT INTO public.funciones (id, codigo, nombre, modulo) VALUES
    (1, 'G_REQ', 'Generar Requisición', 'Requisiciones'),
    (2, 'VB_REQ', 'VoBo Requisición', 'Requisiciones'),
    (3, 'G_RFQ', 'Procesar RFQ / Comparativa', 'Compras'),
    (4, 'VB_RFQ', 'Aprobar RFQ', 'Compras'),
    (5, 'G_OC', 'Generar Orden de Compra', 'Compras'),
    (6, 'VB_OC', 'VoBo Orden de Compra', 'Compras'),
    (7, 'PAY_OC', 'Autorizar Compra / Definir Pago', 'Finanzas'),
    (8, 'REC_OC', 'Enviar OC a Proveedor / Recolección', 'Logística'),
    (9, 'ING_OC', 'Ingresar OC a Almacén', 'Almacén'),
    (11, 'AGREGAR_PRODUCTO', 'Agregar Productos', 'Almacen'),
    (10, 'USUARIOS', 'Administrar usuarios', 'configuracion'),
    (12, 'CONFIG_NOTIFICATION', 'Configurar Notificaciones', 'configuracion')
ON CONFLICT (id) DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
     pgm.sql(`
        DELETE FROM public.funciones WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 10, 12);
    `);

};
