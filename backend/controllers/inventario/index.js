// backend/controllers/inventario/index.js
/**
 * INVENTARIO MODULE EXPORTS
 * =============================================================================
 * Exporta exactamente las funciones que consumen las rutas:
 * - GET  /api/inventario/datos-iniciales
 * - GET  /api/inventario
 * - GET  /api/inventario/catalogo-resumen
 * - GET  /api/inventario/material/:materialId/asignaciones
 * - GET  /api/inventario/kardex
 * - POST /api/inventario/ajustes
 * - POST /api/inventario/apartar
 * - POST /api/inventario/mover-asignacion
 * - POST /api/inventario/movimientos/:id/reversar
 */

const { getDatosIniciales } = require("./datosIniciales.controller");
const {
  getInventarioActual,
  getCatalogoResumen,
  getDetalleAsignacionesMaterial,
} = require("./listados.controller");
const { getKardex, getKardexFilterOptions } = require("./kardex.controller");
const { ajustarInventario } = require("./ajustes.controller");
const { apartarStock, moverAsignacion } = require("./asignaciones.controller");
const { reversarMovimiento } = require("./reversa.controller");

module.exports = {
  getDatosIniciales,
  getInventarioActual,
  getCatalogoResumen,
  getDetalleAsignacionesMaterial,
  getKardex,
  getKardexFilterOptions,
  ajustarInventario,
  apartarStock,
  moverAsignacion,
  reversarMovimiento,
};
