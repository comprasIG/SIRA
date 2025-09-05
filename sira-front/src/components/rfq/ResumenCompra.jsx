// C:\SIRA\sira-front\src\components\rfq\ResumenCompra.jsx
/**
 * Componente: ResumenCompra
 * * Propósito:
 * Muestra un panel con el resumen de las opciones de compra seleccionadas,
 * agrupadas por proveedor. Calcula y muestra el subtotal por proveedor.
 * * Props:
 * - materiales (array): La lista de materiales del formulario con sus opciones.
 * - lugar_entrega (string): El lugar de entrega para mostrar en el resumen.
 */
import React, { useMemo } from 'react';
import { Paper, Typography } from '@mui/material';

// --- Lógica de Negocio ---
// Función pura para calcular el resumen a partir de los materiales
const calcularResumen = (materiales) => {
  if (!materiales || materiales.length === 0) return {};
  const agrupado = {};
  materiales.forEach(material => {
    if (!material || !material.opciones) return;
    material.opciones.forEach(opcion => {
      // La lógica clave: la opción debe estar seleccionada, tener proveedor y cantidad.
      if (opcion && opcion.seleccionado && opcion.proveedor && Number(opcion.cantidad_cotizada) > 0) {
        const razonSocial = opcion.proveedor.razon_social || opcion.proveedor.nombre;
        if (!agrupado[razonSocial]) {
          agrupado[razonSocial] = [];
        }
        const cantidad = Number(opcion.cantidad_cotizada) || 0;
        const precio = Number(opcion.precio_unitario) || 0;
        agrupado[razonSocial].push({
          material: material.material,
          cantidad,
          precio,
          unidad: material.unidad,
          subtotal: cantidad * precio
        });
      }
    });
  });
  return agrupado;
};

export default function ResumenCompra({ materiales, lugar_entrega }) {
  // --- Memorización ---
  // CORRECCIÓN: Se usa JSON.stringify para forzar el recálculo ante cualquier cambio
  // en los datos de los materiales, solucionando el problema del "hot-reload".
  const resumenPorProveedor = useMemo(() => calcularResumen(materiales), [JSON.stringify(materiales)]);

  // --- Renderizado ---
  return (
    <div>
        <Typography variant='h6' className='mb-4'>Resumen de Compra</Typography>
        <Paper variant="outlined" className="p-4 space-y-4">
            <Typography variant="caption" display="block" gutterBottom>
                <strong>Se entrega en:</strong> {lugar_entrega}
            </Typography>
            {Object.keys(resumenPorProveedor).length > 0 ? (
                Object.entries(resumenPorProveedor).map(([proveedor, items]) => {
                    const totalProveedor = items.reduce((acc, item) => acc + (item.subtotal || 0), 0);
                    return (
                         <div key={proveedor}>
                            <Typography variant='subtitle1' className='font-bold'>{proveedor}</Typography>
                            <ul className='list-disc pl-5 text-sm'>
                                {items.map((item, idx) => (
                                    <li key={idx}>
                                        {/* El precio y subtotal ya se muestran con 2 decimales */}
                                        {(Number(item.cantidad) || 0)} {item.unidad} de {item.material} @ ${(Number(item.precio) || 0).toFixed(2)} = <strong>${(Number(item.subtotal) || 0).toFixed(2)}</strong>
                                    </li>
                                ))}
                            </ul>
                            <p className='text-right font-bold'>Sub Total: ${(Number(totalProveedor) || 0).toFixed(2)}</p>
                         </div>
                    );
                })
            ) : (
                <Typography variant="body2" className="text-gray-500 italic">Selecciona un proveedor y marca la casilla "Elegir" para ver el resumen.</Typography>
            )}
        </Paper>
    </div>
  );
}