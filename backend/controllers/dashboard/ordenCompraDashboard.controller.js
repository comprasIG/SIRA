const pool = require('../../db/pool');

/**
 * Obtiene el detalle completo de una Orden de Compra por número de OC.
 * Incluye información de proveedor, proyecto, sitio, usuario y los ítems asociados.
 *
 * Ruta: GET /api/dashboard/oc/:numero_oc
 */
async function getOrdenCompraDetalle(req, res) {
  const { numero_oc } = req.params;

  try {
    // 1) Cabecera OC
    const headerQuery = `
      SELECT
        oc.id,
        oc.numero_oc,
        oc.status,
        oc.fecha_creacion,
        oc.lugar_entrega,
        oc.comentario,
        oc.sub_total,
        oc.iva,
        oc.total,
        oc.impo,
        oc.metodo_pago,
        oc.fecha_vencimiento_pago,
        oc.hold_regresar_en,
        oc.comprobante_pago_link,
        oc.monto_pagado,
        oc.pendiente_liquidar,
        oc.recoleccion_parcial,
        oc.metodo_recoleccion_id,
        oc.paqueteria_id,
        oc.numero_guia,
        oc.comentario_recoleccion,
        oc.paqueteria_pago,
        oc.entrega_responsable,
        oc.entrega_parcial,
        oc.con_incidencia,

        p.nombre            AS proyecto_nombre,
        s.nombre            AS sitio_nombre,
        prov.razon_social   AS proveedor_nombre,
        u.nombre            AS usuario_nombre,

        (
          SELECT MIN(ocd.moneda)
          FROM public.ordenes_compra_detalle ocd
          WHERE ocd.orden_compra_id = oc.id
        ) AS moneda

      FROM public.ordenes_compra oc
      LEFT JOIN public.proyectos p       ON p.id = oc.proyecto_id
      LEFT JOIN public.sitios s          ON s.id = oc.sitio_id
      LEFT JOIN public.proveedores prov  ON prov.id = oc.proveedor_id
      LEFT JOIN public.usuarios u        ON u.id = oc.usuario_id
      WHERE oc.numero_oc = $1
      LIMIT 1
    `;

    const headerResult = await pool.query(headerQuery, [numero_oc]);

    if (headerResult.rows.length === 0) {
      return res.status(404).json({
        error: `No se encontró la OC con número ${numero_oc}`,
      });
    }

    const oc = headerResult.rows[0];

    // 2) Ítems de la OC
    // requisiciones_detalle NO tiene "descripcion", tiene "comentario". :contentReference[oaicite:1]{index=1}
    const itemsQuery = `
      SELECT
        ocd.id,
        ocd.material_id,
        cm.nombre AS material_nombre,
        rd.comentario AS descripcion,
        ocd.cantidad,
        ocd.precio_unitario,
        ocd.moneda,
        (ocd.cantidad * ocd.precio_unitario) AS total,
        ocd.cantidad_recibida
      FROM public.ordenes_compra_detalle ocd
      LEFT JOIN public.catalogo_materiales cm ON cm.id = ocd.material_id
      LEFT JOIN public.requisiciones_detalle rd ON rd.id = ocd.requisicion_detalle_id
      WHERE ocd.orden_compra_id = $1
      ORDER BY ocd.id
    `;

    const itemsResult = await pool.query(itemsQuery, [oc.id]);

    return res.json({
      ordenCompra: {
        id: oc.id,
        numero_oc: oc.numero_oc,
        status: oc.status,
        fecha_creacion: oc.fecha_creacion,
        lugar_entrega: oc.lugar_entrega,
        comentario: oc.comentario,

        sub_total: oc.sub_total,
        iva: oc.iva,
        total: oc.total,
        moneda: oc.moneda || null,

        proveedor_nombre: oc.proveedor_nombre || null,
        proyecto_nombre: oc.proyecto_nombre || null,
        sitio_nombre: oc.sitio_nombre || null,
        usuario_nombre: oc.usuario_nombre || null,

        metodo_pago: oc.metodo_pago,
        fecha_vencimiento_pago: oc.fecha_vencimiento_pago,
        pendiente_liquidar: oc.pendiente_liquidar,
        impo: oc.impo,

        items: itemsResult.rows || [],
      },
    });
  } catch (error) {
    console.error('Error al obtener detalle de la orden de compra:', error);
    return res.status(500).json({
      error: 'Error al obtener detalle de la orden de compra',
      details: error.message,
    });
  }
}

module.exports = {
  getOrdenCompraDetalle,
};
