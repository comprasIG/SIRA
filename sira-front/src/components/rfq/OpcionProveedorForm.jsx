// C:\SIRA\sira-front\src\components\rfq\OpcionProveedorForm.jsx

/**
 * =================================================================================================
 * COMPONENTE: OpcionProveedorForm
 * VERSIÓN: 3.0 (Bloqueo Granular, Layout Mejorado y Documentación Extensiva)
 * =================================================================================================
 * @file OpcionProveedorForm.jsx
 *
 * @description
 * Este componente renderiza el formulario para una única opción de cotización de un material.
 * Gestiona la selección de proveedor, cantidad, precio y otras especificaciones.
 *
 * @features
 * - Búsqueda de proveedores de forma asíncrona con debounce.
 * - Lógica para destacar la opción con el precio más bajo.
 * - Bloqueo granular de la interfaz si la opción ya ha generado una Orden de Compra (OC).
 * La UI de bloqueo es clara, cubriendo y desenfocando los campos para evitar interacción.
 * - Layout responsivo y organizado lógicamente en secciones claras.
 *
 * @props
 * - {object} control: Objeto 'control' de react-hook-form para registrar los campos.
 * - {number} materialIndex: El índice del material padre en el array del formulario.
 * - {number} opcionIndex: El índice de esta opción específica dentro del material.
 * - {function} setValue: Función de react-hook-form para establecer valores de campo.
 * - {function} removeOpcion: Función para eliminar esta opción del array.
 * - {number} totalOpciones: El número total de opciones para este material.
 * - {object} lastUsedProvider: El último proveedor seleccionado para autocompletar.
 * - {function} onProviderSelect: Callback que se ejecuta al seleccionar un proveedor.
 * - {string|number} fieldId: El ID único (de la base de datos) de esta opción.
 * - {array<number>} opcionesBloqueadas: Un array de IDs de opciones que deben estar bloqueadas.
 */

// =================================================================================================
// --- IMPORTACIONES DE LIBRERÍAS Y UTILIDADES ---
// =================================================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem, InputAdornment, IconButton, Tooltip, Paper, Alert, Box, Typography } from '@mui/material';
import api from '../../api/api';
import useDebounce from './useDebounce'; // Hook personalizado para debounce en la búsqueda

// --- Iconos ---
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';


export default function OpcionProveedorForm({
  materialIndex,
  opcionIndex,
  control,
  setValue,
  removeOpcion,
  totalOpciones,
  onProviderSelect,
  lastUsedProvider,
  fieldId,
  opcionesBloqueadas = []
}) {

  // =================================================================================================
  // --- ESTADO DEL COMPONENTE ---
  // =================================================================================================
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Hook personalizado para evitar llamadas a la API en cada pulsación de tecla.
  const debouncedSearchTerm = useDebounce(searchTerm, 500);


  // =================================================================================================
  // --- HOOKS DE REACT-HOOK-FORM (Observadores) ---
  // =================================================================================================
  // Observa el estado completo del formulario para lógica condicional.
  const formState = useWatch({ control });

  // Observa campos específicos para re-renderizar solo cuando cambian.
  const esEntregaInmediata = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata` });
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });


  // =================================================================================================
  // --- LÓGICA DE NEGOCIO Y CÁLCULOS MEMORIZADOS ---
  // =================================================================================================

  // Determina si el formulario debe estar deshabilitado.
  // Se memoriza implícitamente ya que sus dependencias son props.
  const isLocked = opcionesBloqueadas.map(Number).includes(Number(fieldId));

  // Calcula si esta opción tiene el precio más bajo entre todas las opciones del material.
  // `useMemo` previene el recálculo en cada render, solo se ejecuta si los precios cambian.
  const esPrecioMasBajo = useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones
      .map(op => parseFloat(op.precio_unitario))
      .filter(p => !isNaN(p) && p > 0);

    if (preciosValidos.length <= 1) return false;

    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);


  // =================================================================================================
  // --- EFECTOS SECUNDARIOS (API CALLS) ---
  // =================================================================================================

  // `useEffect` para buscar proveedores cuando el término de búsqueda (debounced) cambia.
  useEffect(() => {
    const buscarProveedores = async () => {
      // No realizar la búsqueda si el término es muy corto.
      if (debouncedSearchTerm.length < 3) {
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


  // =================================================================================================
  // --- MANEJADORES DE EVENTOS (EVENT HANDLERS) ---
  // =================================================================================================

  // Maneja el cambio en el checkbox de "Importación".
  const handleImportacionChange = (event) => {
    const isChecked = event.target.checked;
    setValue(`materiales.${materialIndex}.opciones.${opcionIndex}.es_importacion`, isChecked);
  };

  // Maneja el cambio en el checkbox de "Elegir".
  // Incluye lógica para auto-seleccionar el último proveedor usado si no hay uno.
  const handleSeleccionadoChange = (onChange) => (event) => {
    const isChecked = event.target.checked;
    const currentOption = formState.materiales[materialIndex].opciones[opcionIndex];
    if (isChecked && !currentOption.proveedor && lastUsedProvider) {
      const path = `materiales.${materialIndex}.opciones.${opcionIndex}`;
      setValue(`${path}.proveedor`, lastUsedProvider);
      setValue(`${path}.proveedor_id`, lastUsedProvider.id);
      if (onProviderSelect) {
        onProviderSelect(lastUsedProvider);
      }
    }
    onChange(isChecked); // Propaga el evento al controlador de react-hook-form.
  };


  // =================================================================================================
  // --- RENDERIZADO DEL COMPONENTE (JSX) ---
  // =================================================================================================
return (
  <Paper
    elevation={0}
    variant="outlined"
    className="p-4 rounded-md transition-all"
    sx={{ ...(esPrecioMasBajo && !isLocked && { backgroundColor: '#f0fdf4', borderColor: '#4ade80' }) }}
  >
    {isLocked && (
      <Alert severity="info" sx={{ mb: 2 }}>
        Esta opción ya generó una Orden de Compra y no puede ser editada.
      </Alert>
    )}

    {/* Contenedor principal con posicionamiento relativo para anclar la capa de bloqueo. */}
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'visible' }}>
      {/* --- Capa de Bloqueo (Overlay) --- */}
      {isLocked && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(245, 245, 245, 0.7)',
            backdropFilter: 'blur(2px)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LockIcon sx={{ fontSize: 28, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Opción bloqueada por OC
          </Typography>
        </Box>
      )}

      {/* --- Contenido del Formulario --- */}
      <fieldset
        disabled={isLocked}
        className="grid grid-cols-12 gap-x-4 gap-y-2"
        style={{ transition: 'opacity 0.3s', opacity: isLocked ? 0.5 : 1 }}
      >
        {/* SECCIÓN 1: CAMPOS PRINCIPALES DE ENTRADA */}
        <div className="col-span-12 md:col-span-6">
          <Controller
            name={`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor`}
            control={control}
            rules={{ required: "El proveedor es requerido" }}
            render={({ field, fieldState: { error } }) => (
              <Autocomplete
                {...field}
                fullWidth
                options={proveedorOptions}
                getOptionLabel={(option) => option.nombre || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                loading={loadingProveedores}
                onInputChange={(_, val) => setSearchTerm(val)}
                onChange={(_, data) => {
                  setValue(`materiales.${materialIndex}.opciones.${opcionIndex}.proveedor_id`, data?.id || null);
                  field.onChange(data);
                  if (onProviderSelect) onProviderSelect(data);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor (Marca)"
                    size="small"
                    error={!!error}
                    helperText={error?.message}
                    sx={{ '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
                  />
                )}
              />
            )}
          />
        </div>

        <div className="col-span-6 md:col-span-3">
          <Controller
            name={`materiales.${materialIndex}.opciones.${opcionIndex}.cantidad_cotizada`}
            control={control}
            rules={{ required: "Req.", min: { value: 0.01, message: "> 0" } }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                value={field.value ?? 0}
                onChange={e => field.onChange(e.target.valueAsNumber || 0)}
                type="number"
                label="Cantidad"
                size="small"
                fullWidth
                error={!!error}
                helperText={error?.message}
                sx={{ '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
              />
            )}
          />
        </div>

        <div className="col-span-6 md:col-span-3">
          <Controller
            name={`materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario`}
            control={control}
            rules={{ required: "Req.", min: { value: 0, message: "≥ 0" } }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                value={field.value ?? 0}
                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                type="number"
                label="Precio Unitario"
                size="small"
                fullWidth
                error={!!error}
                helperText={error?.message}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
              />
            )}
          />
        </div>

        {/* SECCIÓN 2: OPCIONES Y ACCIONES */}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* ENTREGA INMEDIATA */}
            <Controller
              name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  }
                  label="Entrega Inmediata"
                />
              )}
            />

            {/* TIEMPO DE ENTREGA SI ES IMPORTACIÓN */}
            {control._formValues?.materiales?.[materialIndex]?.opciones?.[opcionIndex]?.es_importacion && (
              <div className="flex items-center gap-2">
                <Controller
                  name={`materiales.${materialIndex}.opciones.${opcionIndex}.tiempo_entrega`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="number"
                      label="Tiempo Entrega"
                      size="small"
                      sx={{ width: 120, '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
                    />
                  )}
                />
                <Controller
                  name={`materiales.${materialIndex}.opciones.${opcionIndex}.unidad_tiempo`}
                  control={control}
                  render={({ field }) => (
                    <Select {...field} size="small">
                      <MenuItem value="dias">días</MenuItem>
                      <MenuItem value="semanas">semanas</MenuItem>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* PRECIO NETO */}
            <Controller
              name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_precio_neto`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  }
                  label="Precio Neto (IVA Incluido)"
                />
              )}
            />

            {/* IMPORTACIÓN */}
            <Controller
              name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_importacion`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  }
                  label="Importación"
                />
              )}
            />
          </div>

          <div className="flex items-center">
            {/* SELECCIONAR COMO GANADORA */}
           <Controller
  name={`materiales.${materialIndex}.opciones.${opcionIndex}.seleccionado`}
  control={control}
  render={({ field }) => (
    <Tooltip title="Seleccionar esta opción como la ganadora para el resumen">
      <FormControlLabel
        control={
          <Checkbox
            {...field}
            checked={!!field.value}
            // --- ¡CORRECCIÓN AQUÍ! ---
            // Llamamos a nuestra función personalizada y le pasamos la original
            onChange={handleSeleccionadoChange(field.onChange)}
          />
        }
        label="Elegir"
      />
    </Tooltip>
  )}
/>
            {/* ELIMINAR OPCIÓN */}
            <Tooltip title="Eliminar esta opción">
              <span>
                <IconButton onClick={() => removeOpcion(opcionIndex)} size="small" color="error" disabled={totalOpciones <= 1}>
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </div>
        </div>
      </fieldset>
    </Box>
  </Paper>
);

}