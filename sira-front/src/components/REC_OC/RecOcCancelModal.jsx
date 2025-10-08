// src/components/REC_OC/RecOcCancelModal.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import api from '../../api/api';

export default function RecOcCancelModal({ open, onClose, onCanceled }) {
  const [ocId, setOcId] = useState('');
  const [motivo, setMotivo] = useState('');

  const cancelar = async ()=>{
    await api.post('/api/rec_oc/cancelar', { orden_compra_id: ocId, motivo });
    setOcId(''); setMotivo('');
    onCanceled?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Cancelar OC</DialogTitle>
      <DialogContent dividers>
        <TextField fullWidth sx={{mt:1}} label="ID de OC" value={ocId} onChange={e=>setOcId(e.target.value)} />
        <TextField fullWidth sx={{mt:2}} label="Motivo" value={motivo} onChange={e=>setMotivo(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button color="error" variant="contained" onClick={cancelar} disabled={!ocId}>Cancelar OC</Button>
      </DialogActions>
    </Dialog>
  );
}
