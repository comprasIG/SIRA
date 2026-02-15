// C:\SIRA\sira-front\src\components\VB_OC\FilaMaterialOC.jsx
/**
 * =================================================================================================
 * FilaMaterialOC.jsx
 * =================================================================================================
 * Fila de material para OC directa. Combina en una sola fila:
 * - Selector de material (Autocomplete del catálogo)
 * - Cantidad + unidad
 * - Selector de proveedor (Autocomplete)
 * - Precio unitario
 * - Checkboxes: precio neto, importación, entrega inmediata
 * - Tiempo de entrega (si no es inmediata)
 * =================================================================================================
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import {
    Autocomplete, TextField, Checkbox, FormControlLabel, Select, MenuItem,
    InputAdornment, IconButton, Tooltip, Paper, Box, Typography, CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/api';

// Debounce simple inline
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function FilaMaterialOC({
    index,
    control,
    setValue,
    remove,
    totalFields,
}) {
    // --- Material search state ---
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialOptions, setMaterialOptions] = useState([]);
    const [materialLoading, setMaterialLoading] = useState(false);
    const debouncedMaterialTerm = useDebounce(materialSearchTerm, 400);

    // --- Provider search state ---
    const [proveedorSearchTerm, setProveedorSearchTerm] = useState('');
    const [proveedorOptions, setProveedorOptions] = useState([]);
    const [proveedorLoading, setProveedorLoading] = useState(false);
    const debouncedProveedorTerm = useDebounce(proveedorSearchTerm, 500);

    // --- Watchers ---
    const esEntregaInmediata = useWatch({ control, name: `items.${index}.es_entrega_inmediata` });

    // --- Material search effect ---
    useEffect(() => {
        const buscar = async () => {
            if (debouncedMaterialTerm.length < 2) {
                setMaterialOptions([]);
                return;
            }
            setMaterialLoading(true);
            try {
                const data = await api.get(`/api/materiales?query=${encodeURIComponent(debouncedMaterialTerm)}`);
                setMaterialOptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Error buscando materiales:', err);
            } finally {
                setMaterialLoading(false);
            }
        };
        buscar();
    }, [debouncedMaterialTerm]);

    // --- Provider search effect ---
    useEffect(() => {
        const buscar = async () => {
            if (debouncedProveedorTerm.length < 3) {
                setProveedorOptions([]);
                return;
            }
            setProveedorLoading(true);
            try {
                const data = await api.get(`/api/proveedores?query=${debouncedProveedorTerm}`);
                setProveedorOptions(data);
            } catch (err) {
                console.error('Error buscando proveedores:', err);
            } finally {
                setProveedorLoading(false);
            }
        };
        buscar();
    }, [debouncedProveedorTerm]);

    // --- Handle material selection ---
    const handleMaterialSelect = async (selectedMaterial, fieldOnChange) => {
        if (selectedMaterial) {
            fieldOnChange(selectedMaterial);
            setValue(`items.${index}.material_id`, selectedMaterial.id);
            // Fetch unit details from backend
            try {
                const details = await api.get(`/api/materiales/${selectedMaterial.id}`);
                setValue(`items.${index}.unidad`, details.unidad || 'N/A');
            } catch {
                setValue(`items.${index}.unidad`, selectedMaterial.unidad || '');
            }
        } else {
            fieldOnChange(null);
            setValue(`items.${index}.material_id`, null);
            setValue(`items.${index}.unidad`, '');
        }
    };

    return (
        <Paper elevation={1} sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* Material Autocomplete */}
                <Box sx={{ flex: '1 1 280px', minWidth: 220 }}>
                    <Controller
                        name={`items.${index}.material`}
                        control={control}
                        rules={{ required: 'Selecciona un material' }}
                        render={({ field, fieldState: { error } }) => (
                            <Autocomplete
                                {...field}
                                options={materialOptions}
                                getOptionLabel={(option) => option?.nombre || ''}
                                filterOptions={(x) => x}
                                loading={materialLoading}
                                isOptionEqualToValue={(option, val) => option?.id === val?.id}
                                onInputChange={(_, val) => setMaterialSearchTerm(val)}
                                onChange={(_, data) => handleMaterialSelect(data, field.onChange)}
                                renderOption={(props, option) => (
                                    <li {...props} key={option.id}>
                                        <div className="flex flex-col">
                                            <span className="font-bold mr-2">{option.sku}</span>
                                            <span>- {option.nombre}</span>
                                        </div>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={`Material #${index + 1}`}
                                        size="small"
                                        error={!!error}
                                        helperText={error?.message}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {materialLoading && <CircularProgress color="inherit" size={20} />}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        )}
                    />
                </Box>

                {/* Cantidad + Unidad */}
                <Box sx={{ width: 130 }}>
                    <Controller
                        name={`items.${index}.cantidad`}
                        control={control}
                        rules={{ required: 'Req.', min: { value: 0.01, message: '> 0' } }}
                        render={({ field, fieldState: { error } }) => (
                            <TextField
                                {...field}
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.valueAsNumber || '')}
                                type="number"
                                label="Cantidad"
                                size="small"
                                fullWidth
                                error={!!error}
                                helperText={error?.message}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Typography variant="caption" color="text.secondary">
                                                {useWatch({ control, name: `items.${index}.unidad` }) || ''}
                                            </Typography>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        )}
                    />
                </Box>

                {/* Proveedor Autocomplete */}
                <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
                    <Controller
                        name={`items.${index}.proveedor`}
                        control={control}
                        rules={{ required: 'Selecciona proveedor' }}
                        render={({ field, fieldState: { error } }) => (
                            <Autocomplete
                                {...field}
                                options={proveedorOptions}
                                getOptionLabel={(option) => option?.nombre || ''}
                                isOptionEqualToValue={(option, val) => option?.id === val?.id}
                                loading={proveedorLoading}
                                onInputChange={(_, val) => setProveedorSearchTerm(val)}
                                onChange={(_, data) => {
                                    setValue(`items.${index}.proveedor_id`, data?.id || null);
                                    field.onChange(data);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Proveedor"
                                        size="small"
                                        error={!!error}
                                        helperText={error?.message}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {proveedorLoading && <CircularProgress color="inherit" size={20} />}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        )}
                    />
                </Box>

                {/* Precio Unitario */}
                <Box sx={{ width: 160 }}>
                    <Controller
                        name={`items.${index}.precio_unitario`}
                        control={control}
                        rules={{
                            required: 'Req.',
                            validate: (v) => {
                                if (v === '' || v === null || v === undefined) return 'Req.';
                                const n = Number(String(v).replace(',', '.'));
                                if (Number.isNaN(n)) return 'Número inválido';
                                if (n < 0) return '>= 0';
                                return true;
                            }
                        }}
                        render={({ field, fieldState: { error } }) => (
                            <TextField
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    const next = raw.replace(',', '.');
                                    if (next === '') { field.onChange(''); return; }
                                    if (/^\d+(\.\d{0,4})?$/.test(next)) {
                                        field.onChange(next);
                                    }
                                }}
                                type="text"
                                inputMode="decimal"
                                label="Precio Unit."
                                size="small"
                                fullWidth
                                error={!!error}
                                helperText={error?.message}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                                }}
                            />
                        )}
                    />
                </Box>

                {/* Delete button */}
                <Box sx={{ display: 'flex', alignItems: 'center', pt: 0.5 }}>
                    <Tooltip title="Eliminar material">
                        <span>
                            <IconButton onClick={() => remove(index)} color="error" disabled={totalFields <= 1} size="small">
                                <DeleteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {/* Row 2: Checkboxes + plazo */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 1.5, pl: 0.5 }}>
                <Controller
                    name={`items.${index}.es_entrega_inmediata`}
                    control={control}
                    render={({ field }) => (
                        <FormControlLabel
                            control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} size="small" />}
                            label="Entrega Inmediata"
                            sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }}
                        />
                    )}
                />

                {!esEntregaInmediata && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Controller
                            name={`items.${index}.tiempo_entrega`}
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} type="number" label="Tiempo" size="small" sx={{ width: 100 }} />
                            )}
                        />
                        <Controller
                            name={`items.${index}.unidad_tiempo`}
                            control={control}
                            render={({ field }) => (
                                <Select {...field} size="small" defaultValue="dias">
                                    <MenuItem value="dias">días</MenuItem>
                                    <MenuItem value="semanas">semanas</MenuItem>
                                </Select>
                            )}
                        />
                    </Box>
                )}

                <Controller
                    name={`items.${index}.es_precio_neto`}
                    control={control}
                    render={({ field }) => (
                        <FormControlLabel
                            control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} size="small" />}
                            label="Precio Neto (IVA Incl.)"
                            sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }}
                        />
                    )}
                />

                <Controller
                    name={`items.${index}.es_importacion`}
                    control={control}
                    render={({ field }) => (
                        <FormControlLabel
                            control={<Checkbox {...field} checked={!!field.value} onChange={field.onChange} size="small" />}
                            label="Importación"
                            sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }}
                        />
                    )}
                />
            </Box>
        </Paper>
    );
}
