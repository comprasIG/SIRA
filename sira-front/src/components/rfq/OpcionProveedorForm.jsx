// C:\SIRA\sira-front\src\components\rfq\OpcionProveedorForm.jsx
// C:\SIRA\sira-front\src\components\rfq\OpcionProveedorForm.jsx

import React, { useState, useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem, InputAdornment, IconButton, Tooltip } from '@mui/material';
import api from '../../api/api';
import DeleteIcon from '@mui/icons-material/Delete';
import clsx from 'clsx';

// Hook de debounce para la búsqueda
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function OpcionProveedorForm({ materialIndex, opcionIndex, control, setValue, removeOpcion, totalOpciones }) {
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Observamos el valor de entrega inmediata para mostrar/ocultar los campos de tiempo de entrega
  const esEntregaInmediata = useWatch({
    control,
    name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata`,
    defaultValue: true
  });
  
  // Lógica para resaltar el precio más bajo
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });
  
  const esPrecioMasBajo = React.useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones
      .map(op => parseFloat(op.precio_unitario))
      .filter(p => !isNaN(p) && p > 0);
    if (preciosValidos.length <= 1) return false;
    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);

  // Efecto para buscar proveedores
  useEffect(() => {
    const buscarProveedores = async () => {
      if (!debouncedSearchTerm) {
        setProveedorOptions([]);
        return;
      }
      setLoadingProveedores(true);
      try {
        const data = await api.get(`/api/proveedores?query=${debouncedSearchTerm}`);
        setProveedorOptions(data);
      } catch (err) {
        console.error("Error buscando proveedores", err);
      } finally {
        setLoadingProveedores(false);
      }
    };
    buscarProveedores();
  }, [debouncedSearchTerm]);

  return (
    <div className={clsx("grid grid-cols-12 gap-x-4 gap-y-2 p-3 border rounded-md transition-all", {
        'border-green-300 bg-green-50': esPrecioMasBajo,
        'border-gray-200': !esPrecioMasBajo
    })}>
      {/* Columna 1: Proveedor */}
      <div className="col-span-12 md:col-span-3">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor`}
          control={control}
          rules={{ required: "El proveedor es requerido" }}
          render={({ field, fieldState: { error } }) => (
            <Autocomplete
              {...field}
              options={proveedorOptions}
              getOptionLabel={(option) => option.nombre || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingProveedores}
              onInputChange={(_, val) => setSearchTerm(val)}
              onChange={(_, data) => {
                setValue(`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor_id`, data?.id || null);
                field.onChange(data);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Proveedor" size="small" error={!!error} helperText={error?.message} />
              )}
            />
          )}
        />
      </div>

      {/* Columna 2: Cantidad y Precio */}
      <div className="col-span-6 md:col-span-2">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.cantidad_cotizada`}
          control={control}
          rules={{ required: true, min: 0.01 }}
          render={({ field, fieldState: { error } }) => (
            <TextField 
                {...field}
                // 👇 CORRECCIÓN AQUÍ
                value={field.value ?? ''} 
                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                type="number" 
                label="Cantidad" 
                size="small" 
                fullWidth 
                error={!!error}
                helperText={error?.message} 
            />
          )}
        />
      </div>
      <div className="col-span-6 md:col-span-2">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario`}
          control={control}
          rules={{ required: true, min: 0 }}
          render={({ field, fieldState: { error } }) => (
            <TextField 
                {...field} 
                // 👇 CORRECCIÓN AQUÍ
                value={field.value ?? ''}
                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                type="number" 
                label="Precio Unitario" 
                size="small" 
                fullWidth 
                error={!!error}
                helperText={error?.message}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          )}
        />
      </div>

      {/* Columna 3: Tiempo de Entrega */}
      <div className="col-span-12 md:col-span-3 flex items-center">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata`}
          control={control}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox {...field} checked={field.value} />} label="Entrega Inmediata" />
          )}
        />
        {!esEntregaInmediata && (
           <div className="flex items-center gap-2">
             <Controller
                name={`materiales.${materialIndex}.opciones.${opcionIndex}.tiempo_entrega_valor`}
                control={control}
                render={({ field }) => <TextField {...field} type="number" size="small" sx={{width: '80px'}} />}
            />
             <Controller
                name={`materiales.${materialIndex}.opciones.${opcionIndex}.tiempo_entrega_unidad`}
                control={control}
                defaultValue="dias"
                render={({ field }) => (
                    <Select {...field} size="small">
                        <MenuItem value="dias">días</MenuItem>
                        <MenuItem value="semanas">semanas</MenuItem>
                    </Select>
                )}
            />
           </div>
        )}
      </div>

      {/* Columna 4: Checkboxes y Acciones */}
      <div className="col-span-12 md:col-span-2 flex items-center justify-between">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.seleccionado`}
          control={control}
          render={({ field }) => (
             <Tooltip title="Seleccionar esta opción como la ganadora">
                <FormControlLabel control={<Checkbox {...field} checked={field.value} />} label="Elegir" />
             </Tooltip>
          )}
        />
        <Tooltip title="Eliminar esta opción">
            <span>
                <IconButton onClick={() => removeOpcion(opcionIndex)} size="small" color="error" disabled={totalOpciones <= 1}>
                    <DeleteIcon />
                </IconButton>
            </span>
        </Tooltip>
      </div>

      {/* Fila inferior para otros checkboxes */}
      <div className="col-span-12 flex gap-4">
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_precio_neto`}
          control={control}
          render={({ field }) => <FormControlLabel control={<Checkbox {...field} checked={field.value} />} label="Precio Neto (IVA Incluido)" />}
        />
        <Controller
          name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_importacion`}
          control={control}
          render={({ field }) => <FormControlLabel control={<Checkbox {...field} checked={field.value} />} label="Importación" />}
        />
      </div>
    </div>
  );
}