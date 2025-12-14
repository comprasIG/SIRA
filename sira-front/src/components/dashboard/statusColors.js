// Mapeo de colores para los diferentes estados de RFQ y OC.
// Estos valores se usan en los componentes de Chips para darle un color consistente.

export const RFQ_STATUS_COLOR = {
  COTIZANDO: 'primary',
  POR_APROBAR: 'warning',
  ESPERANDO_ENTREGA: 'info',
  ENTREGADA: 'success',
  CANCELADA: 'default',
  APROBADA: 'success',
  RECHAZADA: 'error',
};

export const OC_STATUS_COLOR = {
  POR_AUTORIZAR: 'warning',
  AUTORIZADA: 'info',
  EN_PROCESO: 'info',
  ESPERANDO_ENTREGA: 'info',
  COMPLETADA: 'success',
  ENTREGADA: 'success',
  CANCELADA: 'default',
  RECHAZADA: 'error',
};