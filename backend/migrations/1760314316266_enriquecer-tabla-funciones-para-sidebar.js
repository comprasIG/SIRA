// backend/migrations/1760314316266_enriquecer-tabla-funciones-para-sidebar.js

/**
 * Función auxiliar para escapar strings para SQL de forma segura.
 * Reemplaza ' por '' y envuelve el resultado en comillas simples.
 * @param {string | null | undefined} str El texto a escapar.
 * @returns {string} El texto listo para ser insertado en una consulta SQL.
 */
const quote = (str) => {
  if (str === null || typeof str === 'undefined') {
    return 'NULL';
  }
  // La forma estándar de escapar una comilla simple en SQL es duplicándola.
  const escaped = String(str).replace(/'/g, "''");
  return `'${escaped}'`;
};

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = async (pgm) => {
  console.log("Aplicando migración: Enriquecer tabla de funciones para el sidebar dinámico...");

  pgm.addColumns('funciones', {
    icono: { type: 'varchar(50)', notNull: false },
    ruta: { type: 'varchar(100)', notNull: false },
  });
  console.log("Columnas 'icono' y 'ruta' añadidas a la tabla 'funciones'.");

  const funciones = [
    { codigo: 'DASHBOARD', nombre: 'Dashboard', modulo: 'Dashboard', icono: 'DashboardIcon', ruta: '/dashboard' },
    { codigo: 'G_REQ', nombre: 'Generar Requisición', modulo: 'Requisiciones', icono: 'DescriptionIcon', ruta: '/G_REQ' },
    { codigo: 'VB_REQ', nombre: 'Validar Requisición', modulo: 'Requisiciones', icono: 'CheckCircleOutlineIcon', ruta: '/VB_REQ' },
    { codigo: 'G_RFQ', nombre: 'Generar Cotización (RFQ)', modulo: 'Compras', icono: 'RequestQuoteIcon', ruta: '/G_RFQ' },
    { codigo: 'VB_RFQ', nombre: 'Validar Cotización (RFQ)', modulo: 'Compras', icono: 'PlaylistAddCheckIcon', ruta: '/VB_RFQ' },
    { codigo: 'G_OC', nombre: 'Generar Orden Compra', modulo: 'Compras', icono: 'ShoppingCartIcon', ruta: '/G_OC' },
    { codigo: 'VB_OC', nombre: 'Validar Orden Compra', modulo: 'Compras', icono: 'FactCheckIcon', ruta: '/VB_OC' },
    { codigo: 'REC_OC', nombre: 'Recolectar OC', modulo: 'Compras', icono: 'InventoryIcon', ruta: '/REC_OC' },
    { codigo: 'AGREGAR_PRODUCTO', nombre: 'Agregar Producto', modulo: 'Compras', icono: 'AddBusinessOutlinedIcon', ruta: '/agregar-producto' },
    { codigo: 'VER_PRODUCTOS', nombre: 'Ver Productos', modulo: 'Compras', icono: 'FactCheckOutlinedIcon', ruta: '/lista-producto' },
    { codigo: 'PAY_OC', nombre: 'Registrar Pago', modulo: 'Finanzas', icono: 'PriceCheckIcon', ruta: '/PAY_OC' },
    { codigo: 'ING_OC', nombre: 'Ingresar OC a Almacén', modulo: 'Almacén', icono: 'Warehouse', ruta: '/ingresar-oc' },
    { codigo: 'USUARIOS', nombre: 'Usuarios', modulo: 'Configuracion', icono: 'GroupIcon', ruta: '/USUARIOS' },
    { codigo: 'CONFIG_NOTIFICATION', nombre: 'Grupos de Notificación', modulo: 'Configuracion', icono: 'AdminPanelSettingsIcon', ruta: '/config/notificaciones' }
  ];

  for (const func of funciones) {
    const sqlQuery = `
      INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta)
      VALUES (${quote(func.codigo)}, ${quote(func.nombre)}, ${quote(func.modulo)}, ${quote(func.icono)}, ${quote(func.ruta)})
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = ${quote(func.nombre)},
        modulo = ${quote(func.modulo)},
        icono = ${quote(func.icono)},
        ruta = ${quote(func.ruta)};
    `;
    await pgm.sql(sqlQuery);
  }
  
  console.log("Datos de funciones insertados/actualizados correctamente.");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  console.log("Revirtiendo migración: Quitando columnas 'icono' y 'ruta' de 'funciones'.");
  pgm.dropColumns('funciones', ['icono', 'ruta']);
};