// src/components/REC_OC/RecOcNotifyModal.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api from '../../api/api';
import useRecOcCatalogs from './hooks/useRecOcCatalogs';

export default function RecOcNotifyModal({ open, onClose, oc, onSent }) {
  const { metodosNotificacion } = useRecOcCatalogs();
  const [via, setVia] = useState('WHATSAPP');
  const [mensaje, setMensaje] = useState('');

  const send = async ()=>{
    await api.post(`/api/rec_oc/${oc.id}/notificar`, { via, mensaje });
    onSent?.(); // backend cambia status a EN_PROCESO
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Notificar {oc?.numero_oc}</DialogTitle>
      <DialogContent dividers>
        <FormControl fullWidth sx={{ mt:1 }}>
          <InputLabel>Método de notificación</InputLabel>
          <Select label="Método de notificación" value={via} onChange={e=>setVia(e.target.value)}>
            {metodosNotificacion.map(m=><MenuItem key={m.id} value={m.codigo}>{m.nombre}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField sx={{ mt:2 }} fullWidth multiline minRows={4} label="Mensaje" value={mensaje} onChange={e=>setMensaje(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={send}>Enviar</Button>
      </DialogActions>
    </Dialog>
  );
}
