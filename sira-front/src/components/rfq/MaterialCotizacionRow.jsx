// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
/**
 * =================================================================================================
 * COMPONENTE: MaterialCotizacionRow
 * =================================================================================================
 * @file MaterialCotizacionRow.jsx
 * @description Contenedor para un material específico. Gestiona el array de sus
 * opciones de cotización y pasa la información de bloqueo a cada opción individual.
 */
import React from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Button, Tooltip, Typography, Paper, Box } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import OpcionProveedorForm from './OpcionProveedorForm';

export default function MaterialCotizacionRow({ control, materialIndex, setValue, lastUsedProvider, setLastUsedProvider, opcionesBloqueadas = [] }) {
  // --- Hooks ---
  const { fields, append, remove } = useFieldArray({
    control, // Requiere el objeto 'control' del formulario principal
    name: `materiales.${materialIndex}.opciones`,
     keyName: 'key'
    
  });

  const material = useWatch({
    control,
    name: `materiales.${materialIndex}`
  });

  // --- Lógica de Negocio ---
  const cantidadAsignada = material.opciones.reduce((acc, opt) => {
    return opt.seleccionado ? acc + Number(opt.cantidad_cotizada || 0) : acc;
  }, 0);

  const cantidadRestante = material.cantidad - cantidadAsignada;

  // --- Manejadores de Eventos ---
  const handleSplitPurchase = () => {
    if (fields.length < 3) {
      append({
        proveedor: null,
        proveedor_id: null,
        precio_unitario: '',
        cantidad_cotizada: cantidadRestante > 0 ? cantidadRestante.toFixed(2) : 0,
        seleccionado: false,
        es_entrega_inmediata: true,
        es_precio_neto: false,
        es_importacion: false,
      });
    } else {
        toast.warn("Se permite un máximo de 3 proveedores por material.");
    }
  };
  
  // --- Renderizado ---
  return (
    <Paper elevation={1} sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
      {/* Encabezado del Material */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {material.material}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cantidad Requerida: <span style={{ fontWeight: 'bold' }}>{material.cantidad} {material.unidad}</span> | 
            Restante por asignar: <span className={clsx("font-bold", cantidadRestante < 0 ? 'text-red-500' : 'text-green-600')}>{cantidadRestante.toFixed(2)}</span>
          </Typography>
          {cantidadRestante < 0 && <Typography variant="caption" color="error">La cantidad asignada supera la requerida.</Typography>}
        </Box>
        <Tooltip title="Dividir compra entre otro proveedor">
          <span>
            <Button
              onClick={handleSplitPurchase}
              startIcon={<AddCircleOutlineIcon />}
              disabled={fields.length >= 3}
              size="small"
            >
              Añadir Opción
            </Button>
          </span>
        </Tooltip>
      </Box>
      
      {/* Contenedor para las Opciones de Proveedor */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
{fields.map((field, index) => (
  <OpcionProveedorForm
  key={field.key}
    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    fieldId={field?.id_bd ?? field?.id ?? field?.opcion_id ?? field?.original_id}
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    materialIndex={materialIndex}
    opcionIndex={index}
    control={control}
    setValue={setValue}
    removeOpcion={remove}
    totalOpciones={fields.length}
    lastUsedProvider={lastUsedProvider}
    onProviderSelect={setLastUsedProvider}
    opcionesBloqueadas={opcionesBloqueadas}
  />
))}
      </Box>
    </Paper>
  );
}