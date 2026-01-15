// C:\SIRA\sira-front\src\components\G_REQForm\FilaMaterial.jsx
import React, { useMemo } from "react";
import { useController, useWatch } from "react-hook-form";
import { Autocomplete, TextField, IconButton, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import clsx from 'clsx';

export default function FilaMaterial({
  field, index, control, register, errors, watch,
  remove, fields, loading, materialesOptions, setSearchTerm, setSkuSearchTerm,
  handleMaterialChange, unidadesLoading, duplicateMaterialIds
}) {
  const {
    field: materialField,
    fieldState: materialFieldState
  } = useController({
    name: `items.${index}.material`,
    control,
    rules: { required: "Debes seleccionar un material" }
  });

  const materialActual = useWatch({ control, name: `items.${index}.material` });
  const esDuplicado = useMemo(() => {
    if (!materialActual?.id) return false;
    return duplicateMaterialIds.has(String(materialActual.id));
  }, [materialActual, duplicateMaterialIds]);

  const handleSkuSelect = (skuValue) => {
    if (!skuValue) return;
    const normalizedSku = skuValue.trim().toLowerCase();
    if (!normalizedSku) return;
    const matchedMaterial = materialesOptions.find(
      (option) => String(option.sku || '').toLowerCase() === normalizedSku
    );
    if (matchedMaterial) {
      handleMaterialChange(matchedMaterial, materialField.onChange, index);
    }
  };

  return (
    <div
      key={field.id}
      className={clsx(
        "flex items-start gap-4 p-4 border rounded-lg bg-gray-50/50 transition-all duration-300",
        { "bg-red-50 border-red-300": esDuplicado, "border-gray-200": !esDuplicado }
      )}
    >
      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Autocomplete de Material */}
        <div className="md:col-span-5">
          <Autocomplete
            options={materialesOptions}
            getOptionLabel={(option) => option.nombre || ''}
            filterOptions={(x) => x}
            loading={loading}
            onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
            onChange={(_, selectedOption) => handleMaterialChange(selectedOption, materialField.onChange, index)}
            value={materialField.value}
            isOptionEqualToValue={(option, val) => option && val && option.id === val.id}
            renderInput={(params) => (
              <TextField 
                {...params} 
                label={`Material #${index + 1}`} 
                error={!!materialFieldState.error} 
                helperText={materialFieldState.error?.message} 
                variant="outlined" 
                size="small" 
                inputProps={{ 
                  ...params.inputProps, 
                  autoComplete: 'off',
                  'data-row-index': index,
                  'data-field-type': 'material',
                  // CAMBIO: Se añade un índice de campo para navegación horizontal
                  'data-field-index': 0
                }} 
              />
            )}
          />
        </div>
        {/* SKU */}
        <div className="md:col-span-2">
          <TextField
            label={`SKU #${index + 1}`}
            variant="outlined"
            size="small"
            onChange={(event) => setSkuSearchTerm(event.target.value)}
            onBlur={(event) => handleSkuSelect(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSkuSelect(event.target.value);
              }
            }}
            inputProps={{
              autoComplete: 'off',
              'data-row-index': index,
              'data-field-type': 'sku',
              'data-field-index': 1
            }}
            fullWidth
          />
        </div>
        {/* Cantidad y Unidad */}
        <div className="md:col-span-2 flex items-center">
          <input 
            type="number" 
            step="any" 
            placeholder="Cant." 
            min="0" 
            {...register(`items.${index}.cantidad`, { required: "Req.", valueAsNumber: true, min: { value: 1, message: "> 0" } })} 
            className="w-full border-gray-300 rounded-l-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" 
            autoComplete="off" 
            data-row-index={index}
            data-field-type="cantidad"
            // CAMBIO: Se añade un índice de campo para navegación horizontal
            data-field-index={2}
          />
          <span className="inline-flex items-center px-3 h-[40px] rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-600 text-sm font-mono">
            {unidadesLoading[index] ? <CircularProgress size={16} /> : watch(`items.${index}.unidad`) || '...'}
          </span>
        </div>
        {errors.items?.[index]?.cantidad && <span className="text-red-600 text-xs col-span-full md:col-span-1">{errors.items[index].cantidad.message}</span>}
        {/* Comentario de Material */}
        <div className="md:col-span-3">
          <input 
            type="text" 
            placeholder="Comentario (opcional)" 
            {...register(`items.${index}.comentario`)} 
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" 
            autoComplete="off" 
            data-row-index={index}
            data-field-type="comentario"
            // CAMBIO: Se añade un índice de campo para navegación horizontal
            data-field-index={3}
          />
        </div>
      </div>
      {/* Botón de Eliminar */}
      <IconButton onClick={() => remove(index)} color="error" disabled={fields.length <= 1} className="transition-transform duration-300 hover:scale-125">
        <DeleteIcon />
      </IconButton>
    </div>
  );
}
