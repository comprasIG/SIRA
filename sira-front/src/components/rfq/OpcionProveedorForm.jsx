// C:\SIRA\sira-front\src\components\rfq\OpcionProveedorForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: OpcionProveedorForm
 * VERSIÓN REESCRITA: 4.1 (Agrega "Aplicar ↓" sin afectar UI)
 * =================================================================================================
 * @file OpcionProveedorForm.jsx
 * @description Renderiza el formulario para una única opción de cotización de un material.
 * Gestiona la selección de proveedor, precios, cantidades y opciones (ej. importación).
 * Incluye la lógica visual para "bloquear" la fila si ya se ha generado una OC.
 *
 * FASE 1:
 * - Botón discreto "Aplicar ↓": copia configuración hacia abajo desde esta línea (sobrescribe),
 *   delegando la lógica al callback `onApplyDownFrom(materialIndex, opcionIndex)`.
 *
 * @props
 * - {object} control
 * - {number} materialIndex
 * - {number} opcionIndex
 * - {function} setValue
 * - {function} removeOpcion
 * - {number} totalOpciones
 * - {function} onProviderSelect
 * - {object} lastUsedProvider
 * - {string|number|null} fieldId (id de BD de requisiciones_opciones)
 * - {array<number>} opcionesBloqueadas
 * - {function} onApplyDownFrom (NUEVO)
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
import SouthIcon from '@mui/icons-material/South'; // ✅ NUEVO: icono "Aplicar ↓"

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
  fieldId,
  opcionesBloqueadas = [],
  // ✅ NUEVO
  onApplyDownFrom,
}) {

  // --- SECCIÓN 2.1: ESTADO INTERNO DEL COMPONENTE ---
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // --- SECCIÓN 2.2: HOOKS DE REACT-HOOK-FORM (Observadores) ---
  const formState = useWatch({ control });
  const esEntregaInmediata = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata` });
  const allOpciones = useWatch({ control, name: `materiales.${materialIndex}.opciones` });
  const currentPrecio = useWatch({ control, name: `materiales.${materialIndex}.opciones.${opcionIndex}.precio_unitario` });

  // --- SECCIÓN 2.3: LÓGICA DE NEGOCIO Y MEMOS ---
  const isLocked = useMemo(() => {
    if (!fieldId) return false;
    return (opcionesBloqueadas || []).map(Number).includes(Number(fieldId));
  }, [fieldId, opcionesBloqueadas]);

  const esPrecioMasBajo = useMemo(() => {
    if (!currentPrecio) return false;
    const preciosValidos = allOpciones
      .map(op => parseFloat(op.precio_unitario))
      .filter(p => !isNaN(p) && p > 0);
    if (preciosValidos.length <= 1) return false;
    return parseFloat(currentPrecio) === Math.min(...preciosValidos);
  }, [allOpciones, currentPrecio]);

  // --- SECCIÓN 2.4: EFECTOS (API CALLS) ---
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
  const handleSeleccionadoChange = (onChange) => (event) => {
    const isChecked = event.target.checked;
    const currentOption = formState.materiales?.[materialIndex]?.opciones?.[opcionIndex];
    if (isChecked && !currentOption?.proveedor && lastUsedProvider) {
      const path = `materiales.${materialIndex}.opciones.${opcionIndex}`;
      setValue(`${path}.proveedor`, lastUsedProvider);
      setValue(`${path}.proveedor_id`, lastUsedProvider.id);
      if (onProviderSelect) onProviderSelect(lastUsedProvider);
    }
    onChange(isChecked);
  };

  const handleApplyDown = () => {
    if (isLocked) return; // por seguridad extra
    if (typeof onApplyDownFrom !== 'function') return;
    onApplyDownFrom(materialIndex, opcionIndex);
  };

  // --- SECCIÓN 2.6: RENDERIZADO ---
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

      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'visible' }}>
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

        <fieldset
          disabled={isLocked}
          className="grid grid-cols-12 gap-x-4 gap-y-2"
          style={{ transition: 'opacity 0.3s', opacity: isLocked ? 0.5 : 1 }}
        >
          {/* Proveedor */}
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
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
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

          {/* Cantidad */}
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

          {/* Precio Unitario (sin flechas, hasta 4 decimales, permite vacío) */}
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
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = raw.replace(',', '.');
                    if (next === '') {
                      field.onChange('');
                      return;
                    }
                    if (/^\d+(\.\d{0,4})?$/.test(next)) {
                      field.onChange(next);
                    }
                  }}
                  onBlur={(e) => {
                    const v = String(e.target.value ?? '').replace(',', '.');
                    if (v.endsWith('.')) field.onChange(v.slice(0, -1));
                    field.onBlur();
                  }}
                  type="text"
                  inputMode="decimal"
                  label="Precio Unitario"
                  size="small"
                  fullWidth
                  error={!!error}
                  helperText={error?.message}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  inputProps={{ pattern: '^\\d+(\\.\\d{0,4})?$' }}
                  sx={{ '& .MuiOutlinedInput-input': { padding: '12.5px 14px' } }}
                />
              )}
            />
          </div>

          {/* Opciones + acciones */}
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Entrega inmediata */}
              <Controller
                name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_entrega_inmediata`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} />}
                    label="Entrega Inmediata"
                  />
                )}
              />

              {/* Tiempo de entrega (si NO es inmediata) */}
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

              {/* Precio neto */}
              <Controller
                name={`materiales.${materialIndex}.opciones.${opcionIndex}.es_precio_neto`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} />}
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
                    control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} />}
                    label="Importación"
                  />
                )}
              />
            </div>

            {/* Acciones: Elegir + Aplicar ↓ + Eliminar */}
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

              {/* ✅ NUEVO: Aplicar hacia abajo */}
              <Tooltip title="Aplicar a todos ↓ (desde esta línea hacia abajo)">
                <span>
                  <IconButton
                    onClick={handleApplyDown}
                    size="small"
                    color="primary"
                    disabled={isLocked || typeof onApplyDownFrom !== 'function'}
                    sx={{ ml: 0.5 }}
                  >
                    <SouthIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Eliminar esta opción">
                <span>
                  <IconButton
                    onClick={() => removeOpcion(opcionIndex)}
                    size="small"
                    color="error"
                    disabled={isLocked || totalOpciones <= 1}
                  >
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
