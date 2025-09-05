// C:\SIRA\sira-front\src\components\rfq\RFQFormActions.jsx
/**
 * Componente: RFQFormActions
 * * Propósito:
 * Renderiza los botones de acción principales para el formulario de cotización.
 * * Props:
 * - isSaving (boolean): Indica si una operación de guardado está en curso.
 * - onSaveAndExit (function): Handler para el botón 'Guardar y Salir'.
 * - onSendToApproval (function): Handler para el botón 'Enviar a Aprobación'.
 */
import React from 'react';
import { Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';

export default function RFQFormActions({ isSaving, onSaveAndExit, onSendToApproval }) {
  return (
    <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
      <Button onClick={onSaveAndExit} variant="outlined" startIcon={<SaveIcon />} disabled={isSaving}>
           {isSaving ? 'Guardando...' : 'Guardar y Salir'}
      </Button>
      <Button
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          onClick={onSendToApproval}
          disabled={isSaving}
      >
          Enviar a Aprobación
      </Button>
    </div>
  );
}