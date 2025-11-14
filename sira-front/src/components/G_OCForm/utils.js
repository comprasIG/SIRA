// C:\SIRA\sira-front\src\components\G_OCForm\utils.js
export const IVA_RATE_DEFAULT = 0.16;

export function computeLineTotal(material) {
  const cantidad = Number(material.cantidad || 0);
  const precio = Number(material.precioUnitario || 0);
  return cantidad * precio;
}

export function buildTotals(materiales, configuraciones) {
  const subTotal = materiales.reduce((acc, item) => acc + computeLineTotal(item), 0);
  const ivaRate = Number(configuraciones.ivaRate || IVA_RATE_DEFAULT);
  const aplicaIva = configuraciones.aplicaIva !== false && !configuraciones.esImportacion;
  const iva = aplicaIva ? subTotal * ivaRate : 0;
  const total = subTotal + iva;

  return {
    subTotal,
    iva,
    total,
    moneda: configuraciones.moneda || 'MXN',
    esImportacion: Boolean(configuraciones.esImportacion),
  };
}

export function mapPayload(values, usuario) {
  const materiales = (values.materiales || []).map((item) => ({
    material: item.material || null,
    descripcion_manual: item.descripcionManual || '',
    unidad: item.unidad || '',
    cantidad: Number(item.cantidad || 0),
    precio_unitario: Number(item.precioUnitario || 0),
    moneda: item.moneda || 'MXN',
    es_importacion: Boolean(item.esImportacion),
    proveedor: item.proveedor || null,
    proveedor_manual: item.proveedorManual || '',
    comentario: item.comentario || '',
    total_linea: computeLineTotal(item),
  }));

  const datosGenerales = {
    sitio: values.sitioSeleccionado || null,
    sitioNombre: values.sitioNombre || '',
    proyecto: values.proyectoSeleccionado || null,
    proyectoNombre: values.proyectoNombre || '',
    lugarEntrega: values.lugarEntrega || '',
    comentario: values.comentario || '',
    fechaRequerida: values.fechaRequerida || null,
    proveedor: values.proveedorGeneral || null,
    solicitante: usuario ? { id: usuario.id, nombre: usuario.nombre } : null,
  };

  return { materiales, datosGenerales };
}
