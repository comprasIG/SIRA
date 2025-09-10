// C:\SIRA\sira-front\src/components/rfq/OpcionProveedorForm.jsx
/**
 * Componente: OpcionProveedorForm
 * Propósito:
 * Formulario para una única opción de cotización de un material.
 * Resalta la opción con el precio más bajo y autocompleta el proveedor
 * al marcar 'Elegir' si el campo está vacío.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem, InputAdornment, IconButton, Tooltip, Button, Chip, Box, Paper } from '@mui/material';
import api from '../../api/api';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import useDebounce from './useDebounce';

export default function OpcionProveedorForm({ materialIndex, opcionIndex, control, setValue, removeOpcion, totalOpciones, onFilesChange, onProviderSelect, lastUsedProvider }) {
  // --- Estados ---
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [archivos, setArchivos] = useState([]);

  // --- Watchers de React Hook Form ---
  const esEntregaInmediata = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata` });
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });
  const formState = useWatch({ control });
  
  // --- Lógica de Negocio ---
  const esPrecioMasBajo = useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones
      .map(op => parseFloat(op.precio_unitario))
      .filter(p => !isNaN(p) && p > 0);
    if (preciosValidos.length <= 1) return false;
    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);

  // --- Efectos y Handlers ---
  // (El resto de la lógica de negocio y manejadores de eventos no cambia)
  useEffect(() => {
    const buscarProveedores = async () => {
      if (!debouncedSearchTerm) { setProveedorOptions([]); return; }
      setLoadingProveedores(true);
      try {
        const data = await api.get(`/api/proveedores?query=${debouncedSearchTerm}`);
        setProveedorOptions(data);
      } catch (err) { console.error("Error buscando proveedores", err); } 
      finally { setLoadingProveedores(false); }
    };
    buscarProveedores();
  }, [debouncedSearchTerm]);
  
  /*
  const handleFileChange = (e) => {
    const nuevosArchivos = Array.from(e.target.files);
    if (archivos.length + nuevosArchivos.length > 2) {
      toast.warn("Puedes adjuntar un máximo de 2 archivos por proveedor.");
      return;
    }
    const archivosActualizados = [...archivos, ...nuevosArchivos];
    setArchivos(archivosActualizados);
    onFilesChange(opcionIndex, archivosActualizados);
  };

  const handleRemoveFile = (fileName) => {
    const archivosActualizados = archivos.filter(f => f.name !== fileName);
    setArchivos(archivosActualizados);
    onFilesChange(opcionIndex, archivosActualizados);
  };
*/
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
      elevation={0}
      variant="outlined"
      // CAMBIO: Se mantienen solo las clases de estructura en 'className'
      className="grid grid-cols-12 gap-x-4 gap-y-3 p-3 rounded-md transition-all"
      // CAMBIO: Los estilos condicionales ahora se aplican con la prop 'sx'
      sx={{
        // Si es el precio más bajo, aplica estos estilos...
        ...(esPrecioMasBajo && {
          backgroundColor: '#f0fdf4', // Equivalente a bg-green-50
          borderColor: '#4ade80',     // Equivalente a border-green-400
        }),
      }}
    >
      
      {/* --- Campo: Proveedor (Autocomplete) --- */}
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

      {/* --- Campo: Cantidad Cotizada --- */}
      <div className="col-span-6 md:col-span-3">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.cantidad_cotizada`} control={control} rules={{ required: "Req.", min: { value: 0.01, message: "> 0" } }}
          render={({ field, fieldState: { error } }) => ( <TextField {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.valueAsNumber || 0)} type="number" label="Cantidad" size="small" fullWidth error={!!error} helperText={error?.message} /> )}
        />
      </div>

      {/* --- Campo: Precio Unitario --- */}
      <div className="col-span-6 md:col-span-4">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario`} control={control} rules={{ required: "Req.", min: { value: 0, message: ">= 0" } }}
          render={({ field, fieldState: { error } }) => ( <TextField {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} type="number" label="Precio Unitario" size="small" fullWidth error={!!error} helperText={error?.message} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} inputProps={{ step: "0.0001" }} /> )}
        />
      </div>

      {/* --- Fila: Opciones de Entrega y Selección --- */}
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
      
      {/* --- Fila: Checkboxes Neto e Importación --- */}
      <div className="col-span-12 flex flex-wrap gap-x-4 -mt-2">
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_precio_neto`} control={control}
          render={({ field }) => <FormControlLabel control={<Checkbox {...field} checked={!!field.value} />} label="Precio Neto (IVA Incluido)" />}
        />
        <Controller name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_importacion`} control={control}
          render={({ field }) => ( <FormControlLabel control={<Checkbox {...field} checked={!!field.value} onChange={handleImportacionChange} />} label="Importación" /> )}
        />
      </div>


      {/* --- Sección para Adjuntar Archivos --- 
      <div className="col-span-12">
        <Button variant="outlined" size="small" component="label" startIcon={<AttachFileIcon />} disabled={archivos.length >= 2}>
            Adjuntar Cotización (Máx. 2)
            <input type="file" multiple hidden onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx" />
        </Button>
        {archivos.length > 0 && (
            <Box className="mt-2 flex flex-wrap gap-1">
                {archivos.map((file, index) => ( <Chip key={index} label={file.name} size="small" onDelete={() => handleRemoveFile(file.name)} /> ))}
            </Box>
        )}
      </div>
      */}
    </Paper>
  );
}