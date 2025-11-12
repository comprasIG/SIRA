// sira-front/src/components/PICK_IN/RetiroStock_Acciones.jsx
import React from "react";
import { Button, CircularProgress, Stack } from '@mui/material'; // <-- Importación correcta
import SendIcon from '@mui/icons-material/Send';

export default function RetiroStock_Acciones({ isSubmitting, isValid }) {
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={isSubmitting || !isValid} // Se deshabilita si RHF no es válido
        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
      >
        {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro'}
      </Button>
    </Stack>
  );
}