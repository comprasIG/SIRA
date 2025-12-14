// sira-front/src/components/PICK_IN/RetiroStock_FilaMaterial.jsx
import React from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Autocomplete, TextField, IconButton, Stack, Box, Typography, Tooltip } from '@mui/material'; // <-- Importaciones correctas
import { createFilterOptions } from '@mui/material/Autocomplete'; // <-- Importación para filtro
import DeleteIcon from '@mui/icons-material/Delete';
import clsx from 'clsx';

// --- LÓGICA DE FILTRADO "INTELIGENTE" ---
// Función para normalizar texto (ignorar acentos y mayúsculas)
const normalizeText = (str) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const filter = createFilterOptions();

const filterOptions = (options, { inputValue }) => {
    const searchWords = normalizeText(inputValue).split(' ').filter(Boolean);
    if (searchWords.length === 0) {
        // No mostrar nada si no se ha escrito (evita que se abra al hacer clic)
        return []; 
    }

    const filtered = options.filter(option => {
        const materialName = normalizeText(option.nombre);
        // every() asegura que *todas* las palabras de búsqueda estén en el nombre
        return searchWords.every(word => materialName.includes(word));
    });

    return filtered.slice(0, 100); // Limita resultados
};
// --- FIN LÓGICA DE FILTRADO ---

export default function RetiroStock_FilaMaterial(props) {
    const {
        field, index, control, register, errors, watch,
        setValue, remove, materialesOptions
    } = props;

    const selectedMaterial = useWatch({ control, name: `items.${index}.material` });
    
    // --- CORRECCIÓN: Leemos 'stock_total' (que ahora sí viene del backend) ---
    const stockDisponible = selectedMaterial ? (parseFloat(selectedMaterial.stock_total) || 0) : 0;
    const unidad = selectedMaterial ? (selectedMaterial.unidad_simbolo || 'N/A') : '...';

    const handleMaterialChange = (selectedOption, fieldOnChange) => {
        fieldOnChange(selectedOption);

        if (selectedOption) {
            setValue(`items.${index}.unidad`, selectedOption.unidad_simbolo || 'N/A');
            setValue(`items.${index}.stock_disponible`, parseFloat(selectedOption.stock_total) || 0);
        } else {
            setValue(`items.${index}.unidad`, '');
            setValue(`items.${index}.stock_disponible`, 0);
            setValue(`items.${index}.cantidad`, '');
        }
    };

    return (
        <Stack direction="row" spacing={2} alignItems="flex-start"
            className={clsx("transition-all duration-300")}
        >
            <Box sx={{ flexGrow: 1 }}>
                <Controller
                    name={`items.${index}.material`}
                    control={control}
                    rules={{ required: "Debes seleccionar un material" }}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <Autocomplete
                            options={materialesOptions}
                            getOptionLabel={(option) => option.nombre || ''}
                            // --- CORRECCIÓN: Aplicamos el filtro inteligente ---
                            filterOptions={filterOptions}
                            onChange={(_, selectedOption) => handleMaterialChange(selectedOption, onChange)}
                            value={value}
                            isOptionEqualToValue={(option, val) => option && val && option.id === val.id}
                            renderOption={(props, option) => (
                                <li {...props} key={option.id}>
                                    <Stack direction="column" sx={{ width: '100%' }}>
                                        <Typography variant="body2">{option.nombre}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {/* --- CORRECCIÓN: Leemos 'stock_total' --- */}
                                            Stock: {option.stock_total || 0} {option.unidad_simbolo}
                                        </Typography>
                                    </Stack>
                                </li>
                            )}
                            renderInput={(params) => (
                                <TextField 
                                    {...params} 
                                    label={`Material #${index + 1}`} 
                                    error={!!error} 
                                    helperText={error?.message} 
                                    variant="outlined" 
                                    size="small" 
                                    inputProps={{ 
                                        ...params.inputProps, 
                                        autoComplete: 'off',
                                        'data-row-index': index,
                                        'data-field-type': 'material',
                                        'data-field-index': 0
                                    }} 
                                />
                            )}
                        />
                    )}
                />
            </Box>
            
            <TextField
                type="number" 
                label="Cant. a Retirar"
                size="small"
                sx={{ width: '200px' }}
                {...register(`items.${index}.cantidad`, { 
                    required: "Req.", 
                    valueAsNumber: true, 
                    min: { value: 0.01, message: "> 0" },
                    max: { value: stockDisponible, message: `Max: ${stockDisponible}` }
                })}
                error={!!errors.items?.[index]?.cantidad}
                helperText={errors.items?.[index]?.cantidad ? errors.items[index].cantidad.message : `Max: ${stockDisponible}`}
                disabled={!selectedMaterial}
                InputProps={{
                    endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{unidad}</Typography>,
                    inputProps: {
                        step: "any",
                        min: 0,
                        max: stockDisponible,
                        'data-row-index': index,
                        'data-field-type': 'cantidad',
                        'data-field-index': 1
                    }
                }}
            />

            <IconButton onClick={() => remove(index)} color="error" sx={{ mt: 1 }}>
                <DeleteIcon />
            </IconButton>
        </Stack>
    );
}