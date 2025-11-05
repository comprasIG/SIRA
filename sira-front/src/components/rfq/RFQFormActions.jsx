// C:\SIRA\sira-front\src\components\rfq\RFQFormActions.jsx
/**
 * Componente: RFQFormActions
 * Propósito:
 *  - Renderiza los botones de acción principales para el formulario de cotización.
 *  - En modo "VB" muestra solo un botón "Actualizar".
 *
 * Props:
 * - isSaving (boolean): Indica si una operación de guardado está en curso.
 * - isLoading (boolean): Indica si los datos iniciales están cargando.
 * - onSaveAndExit (function): Handler para el botón de guardado (y salida).
 * - onSendToApproval (function): Handler para "Enviar a Aprobación".
 * - mode (string): "G" (default) | "VB". En "VB" se muestra solo "Actualizar".
 */
import React from 'react';
import { Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';

export default function RFQFormActions({ isSaving, isLoading, onSaveAndExit, onSendToApproval, mode = 'G' }) {
  const disabled = isSaving || isLoading;

  // MODO VB: solo un botón "Actualizar"
  if (mode === 'VB') {
    return (
      <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
        <Button
          onClick={onSaveAndExit}
          variant="outlined"
          startIcon={<SaveIcon />}
          disabled={disabled}
        >
          {isSaving ? 'Guardando...' : 'Actualizar'}
        </Button>
      </div>
    );
  }

  // MODO G (por defecto): botones originales
  return (
    <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
      <Button
        onClick={onSaveAndExit}
        variant="outlined"
        startIcon={<SaveIcon />}
        disabled={disabled}
      >
        {isSaving ? 'Guardando...' : 'Guardar y Salir'}
      </Button>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SendIcon />}
        onClick={onSendToApproval}
        disabled={disabled}
      >
        Enviar a Aprobación
      </Button>
    </div>
  );
}
