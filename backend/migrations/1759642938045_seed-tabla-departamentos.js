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
        INSERT INTO public.departamentos (id, codigo, nombre) VALUES
	(1, 'PROD', 'PRODUCCIÓN'),
	(2, 'R-H', 'RECURSOS HUMANOS'),
	(3, 'S-H', 'SEGURIDAD E HIGIENE'),
	(4, 'VTA', 'VENTAS'),
	(5, 'MKT', 'MARKETING'),
	(6, 'ALM', 'ALMACÉN'),
	(32, 'TI', 'SISTEMAS'),
	(21, 'SSD', 'COMPRAS'),
	(22, 'FIN', 'FINANZAS'),
	(23, 'DIR', 'DIRECCIÓN'),
	(33, 'DEI', 'DESARROLLO E INVESTIGACIÓN'),
	(7, 'ING', 'BIOENERGY')
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
        DELETE FROM public.departamentos WHERE id IN (1, 2, 3, 4, 5, 6, 32, 21, 22, 23, 33, 7);
    `);

};
