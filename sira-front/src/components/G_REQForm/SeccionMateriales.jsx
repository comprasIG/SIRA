// C:\SIRA\sira-front\src\components\G_REQForm\SeccionMateriales.jsx
import React from "react";
import { useFieldArray } from "react-hook-form";
import FilaMaterial from "./FilaMaterial";
import { Button } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

export default function SeccionMateriales({ control, register, errors, watch, setValue, loading, materialesOptions, setSearchTerm, handleMaterialChange, unidadesLoading }) {
  const { fields, prepend, remove } = useFieldArray({ control, name: "items" });

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
      <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Materiales Requeridos</h2>
        <Button
          type="button"
          onClick={() => prepend({ material: null, cantidad: '', comentario: '', unidad: '' })}
          startIcon={<AddCircleOutlineIcon />}
          className="transition-transform duration-300 hover:scale-105"
          variant="contained"
        >
          Agregar
        </Button>
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <FilaMaterial
            key={field.id}
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
            setSearchTerm={setSearchTerm}
            handleMaterialChange={handleMaterialChange}
            unidadesLoading={unidadesLoading}
          />
        ))}
      </div>
    </div>
  );
}