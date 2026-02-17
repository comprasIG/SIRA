// C:\SIRA\sira-front\src\components\dashboard\dashboardConfig.js
/**
 * ============================================================================
 * Configuración por departamento para los dashboards.
 * ----------------------------------------------------------------------------
 * Regla:
 *  - SSD (Compras) usa endpoint dedicado: /api/dashboard/compras
 *  - Todos los demás departamentos usan endpoint único: /api/dashboard/departamento
 *    (filtra por el departamento del usuario autenticado en el backend)
 *
 * Ventajas:
 *  - Evita endpoints /api/dashboard/produccion, /ventas, etc. (404)
 *  - Mantiene el patrón de DashboardBase + useDashboard(mode)
 *  - No requiere cambios en BD (códigos con guion no importan aquí)
 * ============================================================================
 */

const DEPARTAMENTO_ENDPOINT = '/api/dashboard/departamento';

const dashboardConfig = {
  SSD: {
    title: 'Dashboard de Compras',
    endpoint: '/api/dashboard/compras',
    showDepartmentFilter: true,
    showProyectosTab: true,
  },

  // Todos los dashboards departamentales comparten el mismo endpoint
  FIN: { title: 'Dashboard de Finanzas', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  ALM: { title: 'Dashboard de Almacén', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  ING: { title: 'Dashboard de Ingreso', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  MKT: { title: 'Dashboard de Marketing', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  RH: { title: 'Dashboard de Recursos Humanos', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  VTA: { title: 'Dashboard de Ventas', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  PROD: { title: 'Dashboard de Producción', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  DIR: { title: 'Dashboard Dirección', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  TI: { title: 'Dashboard de TI', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },

  // Dashboards que NO muestran tab de Proyectos
  UNIDADES: { title: 'Dashboard de Unidades', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: false },
  SITIOS: { title: 'Dashboard de Sitios', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: false },

  // Nota: Si en el futuro agregas DEI (o S-H), solo añade la clave aquí:
  // DEI: { title: 'Dashboard DEI', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
  // SH:  { title: 'Dashboard Seguridad e Higiene', endpoint: DEPARTAMENTO_ENDPOINT, showDepartmentFilter: false, showProyectosTab: true },
};

export default dashboardConfig;
