// src/components/REC_OC/RecOcFilesModal.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api from '../../api/api';

export default function RecOcFilesModal({ open, onClose, oc, onUploaded }) {
  const [tipo, setTipo] = useState('GUIA');
  const [link, setLink] = useState('');

  const upload = async ()=>{
    await api.post(`/api/rec_oc/${oc.id}/archivos`, { archivo_link: link, tipo });
    onUploaded?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Archivos de {oc?.numero_oc}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={tipo} onChange={e=>setTipo(e.target.value)}>
                <MenuItem value="GUIA">Guía</MenuItem>
                <MenuItem value="EVIDENCIA">Evidencia</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Enlace (Drive / URL)" value={link} onChange={e=>setLink(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={upload} disabled={!link}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}
