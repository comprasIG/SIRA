// Configuración por departamento para los dashboards.
// Cada clave corresponde al código del departamento (por ejemplo, SSD para Compras).
// Define el título, el endpoint a consultar y si se muestra el filtro de departamentos.

const dashboardConfig = {
  SSD: {
    title: 'Dashboard de Compras',
    endpoint: '/api/dashboard/compras',
    showDepartmentFilter: true,
  },
  FIN: {
    title: 'Dashboard de Finanzas',
    endpoint: '/api/dashboard/finanzas',
    showDepartmentFilter: false,
  },
  ALM: {
    title: 'Dashboard de Almacén',
    endpoint: '/api/dashboard/almacen',
    showDepartmentFilter: false,
  },
  ING: {
    title: 'Dashboard de Ingreso',
    endpoint: '/api/dashboard/ingreso',
    showDepartmentFilter: false,
  },
  SH: {
    title: 'Dashboard de Seguridad e Higiene',
    endpoint: '/api/dashboard/seguridad',
    showDepartmentFilter: false,
  },
  MKT: {
    title: 'Dashboard de Marketing',
    endpoint: '/api/dashboard/marketing',
    showDepartmentFilter: false,
  },
  RH: {
    title: 'Dashboard de Recursos Humanos',
    endpoint: '/api/dashboard/recursos-humanos',
    showDepartmentFilter: false,
  },
  VTA: {
    title: 'Dashboard de Ventas',
    endpoint: '/api/dashboard/ventas',
    showDepartmentFilter: false,
  },
  PROD: {
    title: 'Dashboard de Producción',
    endpoint: '/api/dashboard/produccion',
    showDepartmentFilter: false,
  },
  DIR: {
    title: 'Dashboard Dirección',
    endpoint: '/api/dashboard/direccion',
    showDepartmentFilter: false,
  },
  TI: {
    title: 'Dashboard de TI',
    endpoint: '/api/dashboard/ti',
    showDepartmentFilter: false,
  },
};

export default dashboardConfig;