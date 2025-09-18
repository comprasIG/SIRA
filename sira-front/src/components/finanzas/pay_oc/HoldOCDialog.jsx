import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack } from '@mui/material';

function formatYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HoldOCDialog({ open, onClose, onConfirm, oc }) {
  const [fecha, setFecha] = useState('');

  useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 30);        // default +30 días
      setFecha(formatYYYYMMDD(d));
    }
  }, [open]);

  const handleClose = () => { setFecha(''); onClose(); };
  const handleConfirm = () => onConfirm(fecha || null);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Poner en hold OC {oc?.numero_oc || ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="date"
            label="Regresar en"
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
