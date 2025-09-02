// C:\SIRA\sira-front\src\components\G_REQForm\AccionesFormulario.jsx
import React from "react";
import { Button, CircularProgress } from '@mui/material';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

export default function AccionesFormulario({ isSubmitting, isEditMode, onFinish, onClean }) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-4 border-t-2 border-gray-200">
      {isEditMode ? (
        <Button
          type="button"
          onClick={onFinish}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700"
        >
          Cancelar
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onClean}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700"
        >
          <CleaningServicesIcon />
          Limpiar Formulario
        </Button>
      )}
      <Button
        type="submit"
        className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-indigo-700 disabled:bg-indigo-400"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <div className="flex items-center gap-2">
            <CircularProgress size={24} color="inherit" />
            <span>{isEditMode ? 'Actualizando...' : 'Enviando...'}</span>
          </div>
        ) : (
          isEditMode ? 'Actualizar Requisición' : 'Guardar Requisición'
        )}
      </Button>
    </div>
  );
}