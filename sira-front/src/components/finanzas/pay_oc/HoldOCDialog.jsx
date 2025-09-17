//C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\HoldOCDialog.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack } from '@mui/material';

export default function HoldOCDialog({ open, onClose, onConfirm, oc }) {
  const [fecha, setFecha] = useState('');
  const handleClose = () => { setFecha(''); onClose(); };
  const handleConfirm = () => onConfirm(fecha || null);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Poner en hold OC {oc?.numero_oc || ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="date"
            label="Regresar en (opcional)"
            InputLabelProps={{ shrink: true }}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button color="warning" variant="contained" onClick={handleConfirm}>
          Poner en hold
        </Button>
      </DialogActions>
    </Dialog>
  );
}
