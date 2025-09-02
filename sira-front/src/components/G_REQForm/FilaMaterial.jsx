// C:\SIRA\sira-front\src\components\G_REQForm\FilaMaterial.jsx
import React from "react";
import { Controller } from "react-hook-form";
import { Autocomplete, TextField, IconButton, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function FilaMaterial({ field, index, control, register, errors, watch, setValue, remove, fields, loading, materialesOptions, setSearchTerm, handleMaterialChange, unidadesLoading }) {
  return (
    <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50/50 transition-all duration-300">
      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Autocomplete de Material */}
        <div className="md:col-span-6">
          <Controller
            name={`items.${index}.material`}
            control={control}
            rules={{ required: "Debes seleccionar un material" }}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Autocomplete
                options={materialesOptions}
                getOptionLabel={(option) => option.nombre || ''}
                filterOptions={(x) => x}
                loading={loading}
                onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
                onChange={(_, selectedOption) => handleMaterialChange(selectedOption, onChange, index)}
                value={value}
                isOptionEqualToValue={(option, val) => option && val && option.id === val.id}
                renderInput={(params) => (
                  <TextField {...params} label={`Material #${index + 1}`} error={!!error} helperText={error?.message} variant="outlined" size="small" inputProps={{ ...params.inputProps, autoComplete: 'off' }} />
                )}
              />
            )}
          />
        </div>
        {/* Cantidad y Unidad */}
        <div className="md:col-span-2 flex items-center">
          <input type="number" step="any" placeholder="Cant." min="0" {...register(`items.${index}.cantidad`, { required: "Req.", valueAsNumber: true, min: { value: 1, message: "> 0" } })} className="w-full border-gray-300 rounded-l-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" autoComplete="off" />
          <span className="inline-flex items-center px-3 h-[40px] rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-600 text-sm font-mono">
            {unidadesLoading[index] ? <CircularProgress size={16} /> : watch(`items.${index}.unidad`) || '...'}
          </span>
        </div>
        {errors.items?.[index]?.cantidad && <span className="text-red-600 text-xs col-span-full md:col-span-1">{errors.items[index].cantidad.message}</span>}
        {/* Comentario de Material */}
        <div className="md:col-span-3">
          <input type="text" placeholder="Comentario (opcional)" {...register(`items.${index}.comentario`)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" autoComplete="off" />
        </div>
      </div>
      {/* Botón de Eliminar */}
      <IconButton onClick={() => remove(index)} color="error" disabled={fields.length <= 1} className="transition-transform duration-300 hover:scale-125">
        <DeleteIcon />
      </IconButton>
    </div>
  );
}