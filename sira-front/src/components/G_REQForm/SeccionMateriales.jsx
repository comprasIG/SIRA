// C:\SIRA\sira-front\src\components\G_REQForm\SeccionMateriales.jsx
import React, { useRef } from "react";
import { useFieldArray } from "react-hook-form";
import FilaMaterial from "./FilaMaterial";
import { Button } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

export default function SeccionMateriales({
  control, register, errors, watch, setValue,
  loading, materialesOptions, skuOptions, skuLoading,
  setSearchTerm, setSkuSearchTerm, handleMaterialChange,
  unidadesLoading, duplicateMaterialIds
}) {
  const { fields, prepend, remove } = useFieldArray({ control, name: "items" });
  const containerRef = useRef(null);
  const fieldOrder = ['sku', 'material', 'cantidad', 'comentario'];

  const handleKeyDown = (e) => {
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
      if (activeElement.closest('[role="combobox"][aria-expanded="true"]')) {
        return;
      }
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
      fieldType === 'comentario' && rowIndex === 0
    ) {
      e.preventDefault();
      prepend({ material: null, cantidad: '', comentario: '', unidad: '' });
      setTimeout(() => {
        const newInput = containerRef.current.querySelector(
          `[data-row-index='0'][data-field-type='sku']`
        );
        if (newInput) newInput.focus();
      }, 50);
    }
  };

  return (
    <div 
      className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl"
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Materiales Requeridos</h2>
        <Button
          type="button"
          onClick={() => prepend({ material: null, cantidad: '', comentario: '', unidad: '' })}
          startIcon={<AddCircleOutlineIcon />}
          variant="contained"
        >
          Agregar
        </Button>
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <FilaMaterial
            key={field.id}
            // CAMBIO: Se vuelve a pasar la prop 'field' que se había omitido.
            field={field}
            index={index}
            control={control}
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            remove={remove}
            fields={fields}
            loading={loading}
            materialesOptions={materialesOptions}
            skuOptions={skuOptions}
            skuLoading={skuLoading}
            setSearchTerm={setSearchTerm}
            setSkuSearchTerm={setSkuSearchTerm}
            handleMaterialChange={handleMaterialChange}
            unidadesLoading={unidadesLoading}
            duplicateMaterialIds={duplicateMaterialIds}
          />
        ))}
      </div>
    </div>
  );
}
