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
        INSERT INTO public.usuarios (nombre, correo, whatsapp, role_id, departamento_id, activo, es_superusuario, correo_google) VALUES
	('SALAS CASTILLO ELIGIA', 'auxadministrativo2@igbiogas.com', '+524492295122', 3, 22, true, false, 'auxfinanzas2.igbiogas@gmail.com'),
	('SALAS BECERRA OSCAR', 'almacen@igbiogas.com', '+524495835507', 5, 6, true, false, 'almacen.igbiogas@gmail.com'),
	('GALLEGOS CORDOVA JESUS EMMANUEL', 'jesus.gallegos@igbiogas.com', '+524493862463', 1, 1, true, false, 'produccion2.igbiogas@gmail.com'),
	('AGUILAR REYES ISMAEL DE JESUS', 'ismael.aguilar@igbiogas.com', '+524491050748', 2, 7, true, false, 'g.tecnico.bioenergy@gmail.com'),
	('USUARIO_PRUEBA', 'compras.biogas@gmail.com', '4494270880', 32, 21, true, true, 'aromero.tai@gmail.com'),
	('AGUSTÍN ROMERO', 'auxcompras@igbiogas.com', '+524494270880', 32, 21, true, true, 'compras.biogas@gmail.com'),
	('LEOS RODRIGUEZ PAOLA GRACIELA', 'paola.graciela@igbiogas.com', '+524491136738', 1, 1, true, false, 'auxproduccion.igbiogas@gmail.com'),
	('CAMARA JARDON JORGE', 'compras@igbiogas.com', '+524494121640', 33, 21, true, false, 'gerente.compras.igbiogas@gmail.com'),
	('OCHOA PEREZ LAURA ALEJANDRA', 'lauraochoa@igbiogas.com', '+524491576956', 35, 22, true, false, 'finanzas.igbiogas@gmail.com'),
	('GOMEZ MARTINEZ MARITZA NAYELI', 'auxadministrativo@igbiogas.com', '+524495543807', 3, 22, true, false, 'auxfinanzas.igbiogas@gmail.com'),
	('GALAN GARZA JUAN MARIO', 'jmgalan@igbiogas.com', '+524491961198', 4, 23, true, false, 'jmgalan.igbiogas@gmail.com'),
	('ALVARO ALÍ SANCHEZ', 'logistica@igbiogas.com', '4494919970', 34, 21, true, false, 'ali.varo55@gmail.com'),
	('MORALES SALAS DIEGO ARMANDO', 'diego.morales@igbiogas.com', '+524499073443', 2, 1, true, false, 'produccion.igbiogas@gmail.com'),
	('ROMO MEDINA JUAN JAVIER', 'javier.romo@igbiogas.com', '+524492794426', 54, 32, true, true, 'sistemas.igbiogas@gmail.com'),
	('GALAN ENCERRADO JUAN', 'juan.galan@igbiogas.com', '+524491557518', 4, 23, true, false, 'jgalan.igbiogas@gmail.com'),
	('BADUY VEGA ANA KARIME', 'design@igbiogas.com', '+524499077570', 1, 4, true, false, 'design.igbiogas@gmail.com'),
	('RODRIGUEZ DELGADO ALFONSO', 'alfonso.rodriguez@igbiogas.com', '+524499068800', 1, 4, true, false, 'ventas.igbiogas@gmail.com'),
	('TORRES ROMO RICARDO', 'ricardo.torres@vitalwater.com', '+524495555093', 2, 4, true, false, 'g.ventas.igbiogas@gmail.com'),
	('OLIVA MARMOLEJO JUAN MANUEL', 'recursoshumanos@igbiogas.com', '+524494590160', 2, 2, true, false, 'rh.igbiogas@gmail.com'),
	('RUVALCABA PEDROZA GLORIA HILARIA', 'desarrolloorganizacional@igbiogas.com', '+524491438751', 2, 2, true, false, 'do.igbiogas@gmail.com'),
	('LOBATO DIAZ KARLA JOHANA ', 'marketing@igbiogas.com', '+524494578766', 1, 4, true, false, 'marketing.igbiogas@gmail.com'),
	('RUBALCAVA LLAMAS NESHLY ARLETTE', 'neshlly.rubalcava@igbiogas.com', '+524491920617', 2, 33, true, false, 'g.investigacion.igbiogas@gmail.com'),
	('ALCARAZ NAVA ULISES ANTONIO', 'ulises.alcaraz@igbiogas.com', '+524491960156', 1, 33, true, false, 'investigacion.igbiogas@gmail.com'),
	('HERNANDEZ ZARCO FELIX', 'felix.hernandez@igbiogas.com', '+524491519279', 1, 7, true, false, 'coordinador.c.bioenergy@gmail.com'),
	('CASILLAS PELLAT JUAN CARLOS', 'juan.casillas@igbiogas.com', '+524494176191', 2, 7, true, false, 'gerente.bioenergy@gmail.com'),
	('GALAN ENCERRADO ADELA MARGARITA', 'adelagalan@igbiogas.com', '+528711415227', 1, 7, true, false, 'coordinador.bioenergy@gmail.com')
ON CONFLICT (correo) DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {};
