// C:\SIRA\sira-front\src/components/rfq/OpcionProveedorForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: OpcionProveedorForm (Con Bloqueo Granular)
 * =================================================================================================
 * @file OpcionProveedorForm.jsx
 * @description Formulario para una única opción de cotización. Ahora se deshabilita a sí mismo
 * si su ID específico está en la lista de opciones que ya generaron una OC.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem, InputAdornment, IconButton, Tooltip, Paper, Alert } from '@mui/material';
import api from '../../api/api';
import DeleteIcon from '@mui/icons-material/Delete';
import clsx from 'clsx';
import useDebounce from './useDebounce';

// --- ¡CORRECCIÓN! Se añaden 'fieldId' y 'opcionesBloqueadas' a las props ---
// Se elimina la prop obsoleta 'onFilesChange'.
export default function OpcionProveedorForm({ materialIndex, opcionIndex, control, setValue, removeOpcion, totalOpciones, onProviderSelect, lastUsedProvider, fieldId, opcionesBloqueadas = [] }) {
  
  // --- Estados y Watchers ---
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const esEntregaInmediata = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata` });
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });
  const formState = useWatch({ control });

  // --- Lógica de Bloqueo Granular ---
  // El formulario se bloquea si el ID de este campo específico está en la lista de bloqueados.
  const isLocked = opcionesBloqueadas.includes(fieldId);
  
  // --- Lógica de Negocio ---
  const esPrecioMasBajo = useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones.map(op => parseFloat(op.precio_unitario)).filter(p => !isNaN(p) && p > 0);
    if (preciosValidos.length <= 1) return false;
    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);

  // --- Efectos y Handlers ---
  useEffect(() => {
    const buscarProveedores = async () => {
      if (debouncedSearchTerm.length < 3) { setProveedorOptions([]); return; }
      setLoadingProveedores(true);
      try {
        const data = await api.get(`/api/proveedores?query=${debouncedSearchTerm}`);
        setProveedorOptions(data);
      } catch (err) { console.error("Error buscando proveedores", err); } 
      finally { setLoadingProveedores(false); }
    };
    buscarProveedores();
  }, [debouncedSearchTerm]);
  
  const handleImportacionChange = (e) => {
    const isChecked = e.target.checked;
    const currentOptionPath = `materiales.${materialIndex}.opciones.${opcionIndex}`;
    const currentProvider = formState.materiales[materialIndex].opciones[opcionIndex].proveedor;
    setValue(`${currentOptionPath}.es_importacion`, isChecked);

    if (isChecked && currentProvider && currentProvider.id) {
      formState.materiales.forEach((material, matIdx) => {
        material.opciones.forEach((opcion, opIdx) => {
          if (opcion.proveedor?.id === currentProvider.id && (matIdx !== materialIndex || opIdx !== opcionIndex)) {
            if (opcion.es_importacion !== true) {
              setValue(`materiales.${matIdx}.opciones.${opIdx}.es_importacion`, true);
            }
          }
        });
      });
    }
  };

  const handleSeleccionadoChange = (onChange) => (e) => {
    const isChecked = e.target.checked;
    const currentOption = formState.materiales[materialIndex].opciones[opcionIndex];
    if (isChecked && !currentOption.proveedor && lastUsedProvider) {
      const path = `materiales.${materialIndex}.opciones.${opcionIndex}`;
      setValue(`${path}.proveedor`, lastUsedProvider);
      setValue(`${path}.proveedor_id`, lastUsedProvider.id);
      if (onProviderSelect) onProviderSelect(lastUsedProvider);
    }
    onChange(isChecked);
  };

  // --- Renderizado ---
  return (
   <Paper 
      elevation={0} variant="outlined" className="p-3 rounded-md transition-all"
      sx={{ ...(esPrecioMasBajo && !isLocked && { backgroundColor: '#f0fdf4', borderColor: '#4ade80' }) }}
    >
       {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Esta opción ya generó una Orden de Compra y no puede ser editada.
        </Alert>
      )}
       <fieldset disabled={isLocked} className="grid grid-cols-12 gap-x-4 gap-y-3">
        <div className="col-span-12 md:col-span-5">
            <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor`} control={control} rules={{ required: "El proveedor es requerido" }}
                render={({ field, fieldState: { error } }) => (
                <Autocomplete {...field} options={proveedorOptions} getOptionLabel={(option) => option.nombre || ''} isOptionEqualToValue={(option, value) => option.id === value.id} loading={loadingProveedores} onInputChange={(_, val) => setSearchTerm(val)}
                    onChange={(_, data) => {
                    setValue(`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor_id`, data?.id || null);
                    field.onChange(data);
                    if (onProviderSelect) onProviderSelect(data);
                    }}
                    renderInput={(params) => (<TextField {...params} label="Proveedor (Marca)" size="small" error={!!error} helperText={error?.message} /> )}
                />
                )}
            />
        </div>

      <div className="col-span-6 md:col-span-3">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.cantidad_cotizada`} control={control} rules={{ required: "Req.", min: { value: 0.01, message: "> 0" } }}
          render={({ field, fieldState: { error } }) => ( <TextField {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.valueAsNumber || 0)} type="number" label="Cantidad" size="small" fullWidth error={!!error} helperText={error?.message} /> )}
        />
      </div>

      <div className="col-span-6 md:col-span-4">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario`} control={control} rules={{ required: "Req.", min: { value: 0, message: ">= 0" } }}
          render={({ field, fieldState: { error } }) => ( <TextField {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} type="number" label="Precio Unitario" size="small" fullWidth error={!!error} helperText={error?.message} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} inputProps={{ step: "0.0001" }} /> )}
        />
      </div>

      <div className="col-span-12 grid grid-cols-12 gap-x-4 items-center">
          <div className="col-span-12 sm:col-span-7 flex flex-wrap items-center">
              <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata`} control={control}
                render={({ field }) => ( <FormControlLabel control={<Checkbox {...field} checked={!!field.value} />} label="Entrega Inmediata" sx={{ mr: 2 }}/> )}
              />
              {!esEntregaInmediata && (
                 <div className="flex items-center gap-2 flex-grow">
                   <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.tiempo_entrega_valor`} control={control} render={({ field }) => <TextField {...field} value={field.value ?? ''} type="number" size="small" sx={{width: '70px'}} />} />
                   <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.tiempo_entrega_unidad`} control={control} defaultValue="dias"
                      render={({ field }) => ( <Select {...field} value={field.value ?? 'dias'} size="small"> <MenuItem value="dias">días</MenuItem> <MenuItem value="semanas">semanas</MenuItem> </Select> )}
                  />
                 </div>
              )}
          </div>
          <div className="col-span-12 sm:col-span-5 flex items-center justify-between">
              <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.seleccionado`} control={control}
                render={({ field }) => (
                   <Tooltip title="Seleccionar esta opción como la ganadora para el resumen">
                      <FormControlLabel control={<Checkbox {...field} checked={!!field.value} onChange={handleSeleccionadoChange(field.onChange)} />} label="Elegir" />
                   </Tooltip>
                )}
              />
              <Tooltip title="Eliminar esta opción">
                  <span>
                      <IconButton onClick={() => removeOpcion(opcionIndex)} size="small" color="error" disabled={totalOpciones <= 1}> <DeleteIcon /> </IconButton>
                  </span>
              </Tooltip>
          </div>
      </div>
      
      <div className="col-span-12 flex flex-wrap gap-x-4 -mt-2">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_precio_neto`} control={control}
          render={({ field }) => <FormControlLabel control={<Checkbox {...field} checked={!!field.value} />} label="Precio Neto (IVA Incluido)" />}
        />
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_importacion`} control={control}
          render={({ field }) => ( <FormControlLabel control={<Checkbox {...field} checked={!!field.value} onChange={handleImportacionChange} />} label="Importación" /> )}
        />
      </div>
  </fieldset>
    </Paper>
  );
}