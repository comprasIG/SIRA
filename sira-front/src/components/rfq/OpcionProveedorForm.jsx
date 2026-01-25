// C:\SIRA\sira-front\src\components\rfq\OpcionProveedorForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: OpcionProveedorForm
 * VERSIÓN REESCRITA: 4.0 (Lógica de bloqueo confirmada y documentación mejorada)
 * =================================================================================================
 * @file OpcionProveedorForm.jsx
 * @description Renderiza el formulario para una única opción de cotización de un material.
 * Gestiona la selección de proveedor, precios, cantidades y opciones (ej. importación).
 * Incluye la lógica visual para "bloquear" la fila si ya se ha generado una OC.
 *
 * @props
 * - {object} control: Objeto 'control' de react-hook-form.
 * - {number} materialIndex: El índice del material padre (ej. 0 para el primer material).
 * - {number} opcionIndex: El índice de esta opción (ej. 0 para la primera opción de ese material).
 * - {function} setValue: Función de react-hook-form para setear valores.
 * - {function} removeOpcion: Función de useFieldArray para eliminar esta opción.
 * - {number} totalOpciones: El número total de opciones para este material.
 * - {function} onProviderSelect: Callback para notificar al padre del último proveedor usado.
 * - {object} lastUsedProvider: Objeto del último proveedor usado (para autocompletar).
 * - {string|number|null} fieldId: El ID de la base de datos (de 'requisiciones_opciones.id').
 * Es 'null' si es una opción nueva.
 * - {array<number>} opcionesBloqueadas: Array de IDs de opciones que ya tienen una OC generada.
 */

// --- SECCIÓN 1: IMPORTACIONES ---
import React, { useState, useEffect, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import {
  Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem,
  InputAdornment, IconButton, Tooltip, Paper, Alert, Box, Typography
} from '@mui/material';
import api from '../../api/api';
import useDebounce from './useDebounce';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';

// --- SECCIÓN 2: COMPONENTE PRINCIPAL ---
export default function OpcionProveedorForm({
  materialIndex,
  opcionIndex,
  control,
  setValue,
  removeOpcion,
  totalOpciones,
  onProviderSelect,
  lastUsedProvider,
  fieldId, // <-- Este es el ID de la BD (ej: 456) o null
  opcionesBloqueadas = []
}) {

  // --- SECCIÓN 2.1: ESTADO INTERNO DEL COMPONENTE ---
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // --- SECCIÓN 2.2: HOOKS DE REACT-HOOK-FORM (Observadores) ---
  // Observamos campos específicos para reaccionar a sus cambios.
  const formState = useWatch({ control });
  const esEntregaInmediata = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata` });
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });

  // --- SECCIÓN 2.3: LÓGICA DE NEGOCIO Y MEMOS ---

  /**
   * @logic {isLocked}
   * Determina si esta fila debe estar bloqueada.
   * Compara el 'fieldId' (que es el id_bd de esta opción) con la lista
   * 'opcionesBloqueadas' recibida del backend.
   */
  // (Esta lógica ya estaba correcta en el archivo que subiste)
  const isLocked = useMemo(() => {
    if (!fieldId) return false; // Una opción nueva (fieldId es null) no puede estar bloqueada.
    return (opcionesBloqueadas || []).map(Number).includes(Number(fieldId));
  }, [fieldId, opcionesBloqueadas]);

  /**
   * @logic {esPrecioMasBajo}
   * Determina si esta opción tiene el precio más bajo entre todas
   * las opciones de este material para resaltarla en verde.
   */
  const esPrecioMasBajo = useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones
      .map(op => parseFloat(op.precio_unitario))
      .filter(p => !isNaN(p) && p > 0);
    if (preciosValidos.length <= 1) return false;
    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);

  // --- SECCIÓN 2.4: EFECTOS (API CALLS) ---

  /**
   * @effect
   * Busca proveedores de forma asíncrona cuando el término de búsqueda
   * (con debounce) cambia.
   */
  useEffect(() => {
    const buscarProveedores = async () => {
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

  // --- SECCIÓN 2.5: MANEJADORES DE EVENTOS ---

  /**
   * @handler
   * Autocompleta el proveedor si se marca "Elegir" y no hay uno
   * seleccionado, usando el último proveedor utilizado.
   */
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
    onChange(isChecked); // Propaga el cambio a react-hook-form
  };

  // --- SECCIÓN 2.6: RENDERIZADO DEL COMPONENTE ---
  return (
    <Paper
      elevation={0}
      variant="outlined"
      className="p-4 rounded-md transition-all"
      sx={{ ...(esPrecioMasBajo && !isLocked && { backgroundColor: '#f0fdf4', borderColor: '#4ade80' }) }}
    >
      {/* --- A: Alerta de Bloqueo (Solo si 'isLocked' es true) --- */}
      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Esta opción ya generó una Orden de Compra y no puede ser editada.
        </Alert>
      )}

      {/* Contenedor relativo para el overlay de bloqueo */}
      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'visible' }}>

        {/* --- B: Overlay de Bloqueo (Solo si 'isLocked' es true) --- */}
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

        {/* --- C: Formulario (Fieldset) --- */}
        {/* El fieldset se deshabilita completo si 'isLocked' es true */}
        <fieldset
          disabled={isLocked}
          className="grid grid-cols-12 gap-x-4 gap-y-2"
          style={{ transition: 'opacity 0.3s', opacity: isLocked ? 0.5 : 1 }}
        >
          {/* C.1: Campos Principales (Proveedor, Cantidad, Precio) */}
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
              rules={{
                required: "Req.",
                validate: (v) => {
                  if (v === '' || v === null || v === undefined) return "Req.";
                  const n = Number(String(v).replace(',', '.'));
                  if (Number.isNaN(n)) return "Número inválido";
                  if (n < 0) return "≥ 0";
                  const s = String(v).replace(',', '.');
                  if (!/^\d+(\.\d{0,4})?$/.test(s)) return "Máx. 4 decimales";
                  return true;
                },
              }}

              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  // Permite dejar el input vacío sin forzar 0
                  value={field.value ?? ''}

                  // Permite solo números con hasta 4 decimales (y permite borrar)
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = raw.replace(',', '.'); // acepta coma

                    // permitir borrar todo
                    if (next === '') {
                      field.onChange('');
                      return;
                    }

                    // solo números + hasta 4 decimales
                    if (/^\d+(\.\d{0,4})?$/.test(next)) {
                      field.onChange(next);
                    }
                  }}

                  // Limpieza ligera al salir: "12." -> "12"
                  onBlur={(e) => {
                    const v = String(e.target.value ?? '').replace(',', '.');
                    if (v.endsWith('.')) field.onChange(v.slice(0, -1));
                    field.onBlur();
                  }}

                  // Sin flechas
                  type="text"
                  inputMode="decimal"

                  label="Precio Unitario"
                  size="small"
                  fullWidth
                  error={!!error}
                  helperText={error?.message}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  inputProps={{
                    pattern: '^\\d+(\\.\\d{0,4})?$',
                  }}
                  sx={{ '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
                />

              )}
            />
          </div>

          {/* C.2: Opciones Secundarias (Checkboxes y Acciones) */}
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

              {/* Entrega Inmediata */}
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

              {/* Tiempo de Entrega (Condicional) */}
              {!esEntregaInmediata && (
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
                      <Select {...field} size="small" defaultValue="dias">
                        <MenuItem value="dias">días</MenuItem>
                        <MenuItem value="semanas">semanas</MenuItem>
                      </Select>
                    )}
                  />
                </div>
              )}

              {/* Precio Neto */}
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

              {/* Importación */}
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

            {/* C.3: Acciones de Fila (Elegir, Borrar) */}
            <div className="flex items-center">
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
                          onChange={handleSeleccionadoChange(field.onChange)}
                        />
                      }
                      label="Elegir"
                    />
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
          </div>
        </fieldset>
      </Box>
    </Paper>
  );
}