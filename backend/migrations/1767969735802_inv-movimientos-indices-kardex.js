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
  // Por proyecto
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_proy_origen ON public.movimientos_inventario (proyecto_origen_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_proy_destino ON public.movimientos_inventario (proyecto_destino_id);`);

  // Referencias
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_oc ON public.movimientos_inventario (orden_compra_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_req ON public.movimientos_inventario (requisicion_id);`);

  // Usuario / ubicación
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_usuario ON public.movimientos_inventario (usuario_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_ubicacion ON public.movimientos_inventario (ubicacion_id);`);

  // Timeline
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_material_fecha ON public.movimientos_inventario (material_id, fecha DESC);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_proy_destino_fecha ON public.movimientos_inventario (proyecto_destino_id, fecha DESC);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mov_inv_tipo_fecha ON public.movimientos_inventario (tipo_movimiento, fecha DESC);`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_tipo_fecha;`);
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_proy_destino_fecha;`);
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_material_fecha;`);

  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_ubicacion;`);
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_usuario;`);

  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_req;`);
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_oc;`);

  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_proy_destino;`);
  pgm.sql(`DROP INDEX IF EXISTS public.idx_mov_inv_proy_origen;`);
};
