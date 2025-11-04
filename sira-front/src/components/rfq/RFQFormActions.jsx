// C:\SIRA\sira-front\src\components\rfq\RFQFormActions.jsx
/**
 * Componente: RFQFormActions
 * * Propósito:
 * Renderiza los botones de acción principales para el formulario de cotización.
 * * Props:
 * - isSaving (boolean): Indica si una operación de guardado está en curso.
 * - isLoading (boolean): (NUEVO) Indica si los datos iniciales están cargando.
 * - onSaveAndExit (function): Handler para el botón 'Guardar y Salir'.
 * - onSendToApproval (function): Handler para el botón 'Enviar a Aprobación'.
 */
import React from 'react';
import { Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';

export default function RFQFormActions({ isSaving, isLoading, onSaveAndExit, onSendToApproval }) {
  return (
    <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
      <Button
        onClick={onSaveAndExit}
        variant="outlined"
        startIcon={<SaveIcon />}
        // CAMBIO: Deshabilitado si está guardando O cargando datos
        disabled={isSaving || isLoading}
      >
        {isSaving ? 'Guardando...' : 'Guardar y Salir'}
      </Button>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SendIcon />}
        onClick={onSendToApproval}
        // CAMBIO: Deshabilitado si está guardando O cargando datos
        disabled={isSaving || isLoading}
      >
        Enviar a Aprobación
      </Button>
    </div>
  );
}