//C:\SIRA\sira-front\src\components\vb_rfq\vbRfqUtils.js
/**
 * =================================================================================================
 * UTILIDADES: Lógica para Visto Bueno RFQ
 * =================================================================================================
 * @file vbRfqUtils.js
 * @description Contiene funciones helper para calcular y procesar datos en la
 * pantalla de Visto Bueno de RFQs.
 */

/**
 * @description Calcula el resumen financiero detallado para un conjunto de opciones de cotización
 * seleccionadas para un único proveedor.
 * @param {Array} opciones - Las opciones de cotización seleccionadas.
 * @returns {object} Un objeto con { subTotal, iva, retIsr, total, moneda, esImportacion }.
 */
export const calcularResumenParaModal = (opciones) => {
  if (!opciones || opciones.length === 0) {
    return { subTotal: 0, iva: 0, retIsr: 0, total: 0, moneda: 'MXN', esImportacion: false };
  }

  // Se asume que todas las opciones de un proveedor comparten la misma configuración guardada.
  const config = opciones[0]?.config_calculo || { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false };
  
  const ivaRateNum = parseFloat(config.ivaRate) || 0;
  const isrRateNum = parseFloat(config.isrRate) || 0;

  const esImportacion = opciones.some(op => op.es_importacion === true);

  let subTotal = 0;
  opciones.forEach(item => {
    const cantidad = Number(item.cantidad_cotizada) || 0;
    let precioBase = Number(item.precio_unitario) || 0;
    // Si el precio es neto, se calcula el precio base antes de impuestos.
    if (item.es_precio_neto && config.isIvaActive && ivaRateNum > 0) {
      precioBase = precioBase / (1 + ivaRateNum);
    }
    subTotal += cantidad * precioBase;
  });

  const iva = (esImportacion || !config.isIvaActive) ? 0 : subTotal * ivaRateNum;
  const retIsr = (esImportacion || !config.isIsrActive) ? 0 : subTotal * isrRateNum;
  const total = subTotal + iva - retIsr;

  return { subTotal, iva, retIsr, total, moneda: config.moneda, esImportacion };
};