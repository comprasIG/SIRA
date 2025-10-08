// src/components/REC_OC/RecOcHistoryModal.jsx
import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText } from '@mui/material';
import api from '../../api/api';

export default function RecOcHistoryModal({ open, onClose, oc }) {
  const [items, setItems] = useState([]);

  useEffect(()=>{
    if (!open || !oc) return;
    (async()=>{
      const res = await api.get(`/api/rec_oc/${oc.id}/historial`);
      setItems(Array.isArray(res.data) ? res.data : res);
    })();
  }, [open, oc]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Historial {oc?.numero_oc}</DialogTitle>
      <DialogContent dividers>
        <List dense>
          {items.map(it=>(
            <ListItem key={it.id} divider>
              <ListItemText
                primary={`${it.accion_realizada} — ${new Date(it.creado_en).toLocaleString()}`}
                secondary={it.detalles}
              />
            </ListItem>
          ))}
          {!items.length && <div>No hay historial.</div>}
        </List>
      </DialogContent>
    </Dialog>
  );
}
