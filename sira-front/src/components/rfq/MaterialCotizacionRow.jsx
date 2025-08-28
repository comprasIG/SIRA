// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
import React from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import OpcionProveedorForm from './OpcionProveedorForm';
import { Button, IconButton, Tooltip } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert'; // Placeholder for 3-dot menu
import clsx from 'clsx';

export default function MaterialCotizacionRow({ control, materialIndex, setValue }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `materiales.${materialIndex}.opciones`
  });

  const material = useWatch({
    control,
    name: `materiales.${materialIndex}`
  });

  const handleSplitPurchase = () => {
    if (fields.length < 3) {
      append({
        proveedor: null,
        precio_unitario: '',
        cantidad_cotizada: 0,
        seleccionado: false,
        es_entrega_inmediata: true,
        es_precio_neto: false,
        es_importacion: false,
      });
    } else {
        alert("Se permite un máximo de 3 proveedores por material.");
    }
  };
  
  // Calcula la cantidad total ya asignada en las opciones seleccionadas
  const cantidadAsignada = material.opciones.reduce((acc, opt) => {
    return opt.seleccionado ? acc + Number(opt.cantidad_cotizada || 0) : acc;
  }, 0);
  
  const cantidadRestante = material.cantidad - cantidadAsignada;

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-6">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-bold text-lg text-indigo-700">{material.material}</h3>
          <p className="text-sm text-gray-600">
            Cantidad Requerida: <span className="font-semibold">{material.cantidad} {material.unidad}</span> | 
            Restante por asignar: <span className={clsx("font-bold", cantidadRestante < 0 ? 'text-red-500' : 'text-green-600')}>{cantidadRestante.toFixed(2)}</span>
          </p>
          {cantidadRestante < 0 && <p className='text-xs text-red-500'>La cantidad asignada supera la requerida.</p>}
        </div>
        <div>
            <Tooltip title="Dividir compra entre otro proveedor">
                <span>
                    <Button
                        onClick={handleSplitPurchase}
                        startIcon={<AddCircleOutlineIcon />}
                        disabled={fields.length >= 3}
                    >
                        Añadir Opción
                    </Button>
                </span>
            </Tooltip>
        </div>
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <OpcionProveedorForm
            key={field.id}
            materialIndex={materialIndex}
            opcionIndex={index}
            control={control}
            setValue={setValue}
            removeOpcion={remove}
            totalOpciones={fields.length}
          />
        ))}
      </div>
    </div>
  );
}