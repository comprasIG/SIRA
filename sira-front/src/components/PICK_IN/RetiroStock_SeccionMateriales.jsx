// sira-front/src/components/PICK_IN/RetiroStock_SeccionMateriales.jsx
import React, { useRef } from 'react';
import { useFieldArray } from 'react-hook-form';
import { Button, Stack, Paper, Typography, InputAdornment, TextField } from '@mui/material'; // <-- Importaciones correctas
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
// import SearchIcon from '@mui/icons-material/Search'; // No lo usamos aquí
import RetiroStock_FilaMaterial from './RetiroStock_FilaMaterial';

export default function RetiroStock_SeccionMateriales(props) {
    const { control, register, errors, watch, setValue, materialesEnStock } = props;
    
    const { fields, prepend, remove } = useFieldArray({ control, name: "items" });
    const containerRef = useRef(null);
    const fieldOrder = ['material', 'cantidad'];

    // --- Lógica de Búsqueda global eliminada ---

    const handleKeyDown = (e) => {
        // ... (Lógica de navegación onKeyDown idéntica a la versión anterior) ...
        const activeElement = document.activeElement;
        const rowIndex = parseInt(activeElement.getAttribute('data-row-index'), 10);
        const fieldIndex = parseInt(activeElement.getAttribute('data-field-index'), 10);
        const fieldType = activeElement.getAttribute('data-field-type');

        if (isNaN(rowIndex) || !fieldType) return;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const nextFieldIndex = e.key === 'ArrowLeft' ? fieldIndex - 1 : fieldIndex + 1;
            if (nextFieldIndex >= 0 && nextFieldIndex < fieldOrder.length) {
                const nextFieldType = fieldOrder[nextFieldIndex];
                const nextInput = containerRef.current.querySelector(
                    `[data-row-index='${rowIndex}'][data-field-type='${nextFieldType}']`
                );
                if (nextInput) nextInput.focus();
            }
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (activeElement.closest('[role="combobox"][aria-expanded="true"]')) return;
            e.preventDefault();
            const nextIndex = e.key === 'ArrowUp' ? rowIndex - 1 : rowIndex + 1;
            if (nextIndex >= 0 && nextIndex < fields.length) {
                const nextInput = containerRef.current.querySelector(
                    `[data-row-index='${nextIndex}'][data-field-type='${fieldType}']`
                );
                if (nextInput) nextInput.focus();
            }
        }

        if (
            e.key === 'Tab' && !e.shiftKey &&
            fieldType === 'cantidad' && rowIndex === (fields.length - 1)
        ) {
            e.preventDefault();
            prepend({ material: null, cantidad: '', unidad: '', stock_disponible: 0 });
            setTimeout(() => {
                const nextRowIndex = fields.length;
                const newInput = containerRef.current.querySelector(
                    `[data-row-index='${nextRowIndex}'][data-field-type='material']`
                );
                if (newInput) newInput.focus();
            }, 50);
        }
    };

    return (
        <Stack spacing={2} onKeyDown={handleKeyDown} ref={containerRef}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ mt: 2 }}>2. Selecciona Materiales y Cantidades</Typography>
                {/* --- CAMBIO: Se eliminó el TextField de búsqueda global --- */}
                <Button
                    type="button"
                    onClick={() => prepend({ material: null, cantidad: '', unidad: '', stock_disponible: 0 })}
                    startIcon={<AddCircleOutlineIcon />}
                    variant="contained"
                >
                    Agregar
                </Button>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
                <Stack spacing={3}>
                    {fields.map((field, index) => (
                        <RetiroStock_FilaMaterial
                            key={field.id}
                            field={field}
                            index={index}
                            control={control}
                            register={register}
                            errors={errors}
                            watch={watch}
                            setValue={setValue}
                            remove={remove}
                            // --- CAMBIO: Pasamos la lista COMPLETA de materiales ---
                            materialesOptions={materialesEnStock}
                        />
                    ))}
                    {fields.length === 0 && (
                        <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                            Haz clic en "Agregar" para añadir materiales al retiro.
                        </Typography>
                    )}
                </Stack>
            </Paper>
        </Stack>
    );
}