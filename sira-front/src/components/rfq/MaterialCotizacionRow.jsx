// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
/**
 * =================================================================================================
 * COMPONENTE: MaterialCotizacionRow
 * =================================================================================================
 * @file MaterialCotizacionRow.jsx
 * @description Contenedor para un material específico y sus opciones de cotización.
 * Ahora incluye una lógica para "congelarse" (deshabilitarse) si el material
 * ya ha sido procesado en una Orden de Compra.
 */
import React from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Button, Tooltip, Typography, Paper, Box, Alert } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import OpcionProveedorForm from './OpcionProveedorForm';

export default function MaterialCotizacionRow({ control, materialIndex, setValue, onFilesChange, lastUsedProvider, setLastUsedProvider }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `materiales.${materialIndex}.opciones`
  });

  const material = useWatch({
    control,
    name: `materiales.${materialIndex}`
  });

  // --- ¡MEJORA! Lógica de "Congelamiento" ---
  // Si el status_compra ya no es 'PENDIENTE', la fila se bloquea.
  const isLocked = material.status_compra !== 'PENDIENTE';

  const cantidadAsignada = material.opciones.reduce((acc, opt) => {
    return opt.seleccionado ? acc + Number(opt.cantidad_cotizada || 0) : acc;
  }, 0);

  const cantidadRestante = material.cantidad - cantidadAsignada;

  const handleSplitPurchase = () => {
    if (fields.length < 3) {
      append({
        proveedor: null,
        proveedor_id: null,
        precio_unitario: '',
        cantidad_cotizada: cantidadRestante > 0 ? cantidadRestante : 0,
        seleccionado: false,
        es_entrega_inmediata: true,
        es_precio_neto: false,
        es_importacion: false,
      });
    } else {
        toast.warn("Se permite un máximo de 3 proveedores por material.");
    }
  };
  
  const handleChildFilesChange = (opcionIndex, files) => {
    if (onFilesChange) {
      onFilesChange(materialIndex, opcionIndex, files);
    }
  };
  
  return (
    <Paper elevation={1} sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, mb: 3, opacity: isLocked ? 0.6 : 1 }}>
      {/* Añadimos un aviso si la fila está bloqueada */}
      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Esta línea ya tiene una Orden de Compra generada (OC #{material.status_compra}) y no puede ser editada.
        </Alert>
      )}
      
      {/* Envolvemos el contenido en un <fieldset> para deshabilitar todo a la vez */}
      <fieldset disabled={isLocked}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map((field, index) => (
            <OpcionProveedorForm
              key={field.id}
              materialIndex={materialIndex}
              opcionIndex={index}
              control={control}
              setValue={setValue}
              removeOpcion={remove}
              totalOpciones={fields.length}
              onFilesChange={handleChildFilesChange}
              onProviderSelect={setLastUsedProvider}
              lastUsedProvider={lastUsedProvider}
            />
          ))}
        </Box>
      </fieldset>
    </Paper>
  );
}