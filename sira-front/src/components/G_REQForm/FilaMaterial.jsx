// C:\SIRA\sira-front\src\components\G_REQForm\FilaMaterial.jsx
import React, { useMemo } from "react";
import { useController, useWatch } from "react-hook-form";
import { Autocomplete, TextField, IconButton, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import clsx from 'clsx';

export default function FilaMaterial({
  field, index, control, register, errors, watch,
  remove, fields, loading, materialesOptions,
  setSearchTerm,
  handleMaterialChange, unidadesLoading, duplicateMaterialIds,
  proyectoId
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
  const stockGeneral = useWatch({ control, name: `items.${index}.stock_general` });
  const apartadoProyecto = useWatch({ control, name: `items.${index}.apartado_proyecto` });

  const esDuplicado = useMemo(() => {
    if (!materialActual?.id) return false;
    return duplicateMaterialIds.has(String(materialActual.id));
  }, [materialActual, duplicateMaterialIds]);

  return (
    <div
      key={field.id}
      className={clsx(
        "flex items-start gap-4 p-4 border rounded-lg bg-gray-50/50 transition-all duration-300",
        { "bg-red-50 border-red-300": esDuplicado, "border-gray-200": !esDuplicado }
      )}
    >
      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

        {/* Autocomplete Unificado (SKU o Nombre) */}
        <div className="md:col-span-6">
          <Autocomplete
            options={materialesOptions}
            getOptionLabel={(option) => option ? `${option.sku} - ${option.nombre}` : ''}
            filterOptions={(x) => x}
            loading={loading}
            onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
            onChange={(_, selectedOption) => handleMaterialChange(selectedOption, materialField.onChange, index, proyectoId)}
            value={materialField.value}
            isOptionEqualToValue={(option, val) => option && val && option.id === val.id}
            renderOption={(props, option, state) => (
              <li
                {...props}
                key={option.id}
                className={`${props.className} ${state.index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
              >
                <div className="flex flex-col">
                  <div>
                    <span className="font-bold mr-2">{option.sku}</span>
                    <span>- {option.nombre}</span>
                  </div>
                </div>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Material o SKU #${index + 1}`}
                error={!!materialFieldState.error}
                helperText={materialFieldState.error?.message}
                variant="outlined"
                size="small"
                inputProps={{
                  ...params.inputProps,
                  autoComplete: 'off',
                  'data-row-index': index,
                  'data-field-type': 'material',
                  'data-field-index': 1
                }}
              />
            )}
          />
        </div>

        {/* Información de Stock */}
        <div className="md:col-span-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-100 h-[40px] flex flex-col justify-center shadow-sm">
          {materialActual ? (
            <>
              <div className="flex justify-between">
                <span>Stock General:</span>
                <span className="font-semibold">{stockGeneral ?? 0}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Apartado Proy:</span>
                <span className="font-semibold">{apartadoProyecto ?? 0}</span>
              </div>
            </>
          ) : (
            <span className="text-gray-400 italic text-center">Selecciona un material</span>
          )}
        </div>

        {/* Cantidad y Unidad */}
        <div className="md:col-span-2 flex items-center">
          <input
            type="number"
            step="0.0001"
            placeholder="Cant."
            min="0"
            {...register(`items.${index}.cantidad`, { required: "Req.", valueAsNumber: true, min: { value: 0.0001, message: "> 0" } })}
            className="w-full border-gray-300 rounded-l-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoComplete="off"
            data-row-index={index}
            data-field-type="cantidad"
            data-field-index={2}
          />
          <span className="inline-flex items-center px-3 h-[40px] rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-600 text-sm font-mono overflow-hidden whitespace-nowrap">
            {unidadesLoading[index] ? <CircularProgress size={16} /> : watch(`items.${index}.unidad`) || '...'}
          </span>
        </div>
        {errors.items?.[index]?.cantidad && <span className="text-red-600 text-xs col-span-full md:col-span-1">{errors.items[index].cantidad.message}</span>}

        {/* Comentario de Material */}
        <div className="md:col-span-2">
          <input
            type="text"
            placeholder="Comentario (opcional)"
            {...register(`items.${index}.comentario`)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
            autoComplete="off"
            data-row-index={index}
            data-field-type="comentario"
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
