// src/components/REC_OC/RecOcMethodModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField, Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import api from '../../api/api';
import useRecOcCatalogs from './hooks/useRecOcCatalogs';

export default function RecOcMethodModal({ open, onClose, oc, onSaved }) {
  const { metodosRecoleccion = [], paqueterias = [], loading } = useRecOcCatalogs();

  const [form, setForm] = useState({
    metodo_recoleccion_id: '',
    paqueteria_id: '',
    paqueteria_pago: '',
    recoleccion_parcial: false,
    comentario_recoleccion: ''
  });

  // Prefill comentario cuando hay OC
  useEffect(() => {
    if (oc) {
      setForm(s => ({
        ...s,
        comentario_recoleccion: s.comentario_recoleccion || `OC ${oc.numero_oc}: `
      }));
    }
  }, [oc]);

  // Si aún no abre, no renderizamos nada (evita cálculos innecesarios)
  if (!open) return null;

  // Método seleccionado (seguro)
  const metodoSel = useMemo(() => {
    if (!Array.isArray(metodosRecoleccion)) return null;
    return metodosRecoleccion.find(m => m.id === form.metodo_recoleccion_id) || null;
  }, [metodosRecoleccion, form.metodo_recoleccion_id]);

  const showPaqueteria = metodoSel?.codigo === 'PAQUETERIA';

  const canSave = !!form.metodo_recoleccion_id && (!showPaqueteria || !!form.paqueteria_id);

  const save = async () => {
    await api.post(`/api/rec_oc/${oc.id}/metodo`, {
      metodo_recoleccion_id: form.metodo_recoleccion_id || null,
      paqueteria_id: showPaqueteria ? (form.paqueteria_id || null) : null,
      paqueteria_pago: showPaqueteria ? (form.paqueteria_pago || null) : null,
      recoleccion_parcial: !!form.recoleccion_parcial,
      comentario_recoleccion: form.comentario_recoleccion || null
    });
    onSaved?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Método de recolección {oc?.numero_oc || ''}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Grid container justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Grid>
        ) : (
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Método</InputLabel>
                <Select
                  label="Método"
                  value={form.metodo_recoleccion_id}
                  onChange={e => setForm(s => ({ ...s, metodo_recoleccion_id: e.target.value, paqueteria_id: '', paqueteria_pago: '' }))}
                >
                  {Array.isArray(metodosRecoleccion) && metodosRecoleccion.map(m =>
                    <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            {showPaqueteria && (
              <>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Paquetería</InputLabel>
                    <Select
                      label="Paquetería"
                      value={form.paqueteria_id}
                      onChange={e => setForm(s => ({ ...s, paqueteria_id: e.target.value }))}
                    >
                      {Array.isArray(paqueterias) && paqueterias.map(p =>
                        <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Pago paquetería</InputLabel>
                    <Select
                      label="Pago paquetería"
                      value={form.paqueteria_pago}
                      onChange={e => setForm(s => ({ ...s, paqueteria_pago: e.target.value }))}
                    >
                      <MenuItem value="POR_COBRAR">Por cobrar</MenuItem>
                      <MenuItem value="PAGADA_POR_PROVEEDOR">Pagada por proveedor</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!form.recoleccion_parcial}
                    onChange={e => setForm(s => ({ ...s, recoleccion_parcial: e.target.checked }))}
                  />
                }
                label="Permitir recolección parcial"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Comentario"
                value={form.comentario_recoleccion}
                onChange={e => setForm(s => ({ ...s, comentario_recoleccion: e.target.value }))}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={save} disabled={!canSave || loading}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
