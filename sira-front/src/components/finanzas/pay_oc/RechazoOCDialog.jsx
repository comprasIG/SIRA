import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

export default function RechazoOCDialog({ open, onClose, onConfirm, oc }) {
  const [motivo, setMotivo] = useState('');
  const handleClose = () => { setMotivo(''); onClose(); };
  const handleConfirm = () => onConfirm(motivo);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Rechazar OC {oc?.numero_oc || ''}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label="Motivo del rechazo (obligatorio)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button color="error" variant="contained" onClick={handleConfirm} disabled={!motivo.trim()}>
          Rechazar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
