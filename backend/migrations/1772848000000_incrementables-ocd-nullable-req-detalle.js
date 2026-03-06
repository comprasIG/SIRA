/**
 * Migración: Hacer nullable requisicion_detalle_id y comparativa_precio_id
 * en ordenes_compra_detalle para soportar líneas de OC incrementable.
 *
 * Las OC incrementables no pasan por el flujo RFQ tradicional, por lo que
 * no tienen requisicion_detalle ni comparativa_precio asociados.
 * (Patrón idéntico al que ya aplicamos para material_id en la migración _795.)
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.ordenes_compra_detalle
      ALTER COLUMN requisicion_detalle_id DROP NOT NULL,
      ALTER COLUMN comparativa_precio_id  DROP NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.ordenes_compra_detalle
      ALTER COLUMN requisicion_detalle_id SET NOT NULL,
      ALTER COLUMN comparativa_precio_id  SET NOT NULL;
  `);
};
