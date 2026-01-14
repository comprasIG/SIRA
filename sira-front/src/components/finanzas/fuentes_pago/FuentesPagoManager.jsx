import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import api from '@/api/api';
import { toast } from 'react-toastify';

const TIPOS = ['BANCO','EFECTIVO','TARJETA','OTRO'];

export default function FuentesPagoManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null); // row
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('OTRO');
  const [activo, setActivo] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/finanzas/fuentes-pago');
      setRows(data || []);
    } catch (e) {
      toast.error(e?.error || 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEdit(null);
    setNombre('');
    setTipo('OTRO');
    setActivo(true);
    setOpen(true);
  };

  const openEdit = (r) => {
    setEdit(r);
    setNombre(r.nombre);
    setTipo(r.tipo);
    setActivo(!!r.activo);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const canSave = useMemo(() => nombre.trim().length > 0 && TIPOS.includes(tipo), [nombre, tipo]);

  const save = async () => {
    if (!canSave) return;

    try {
      if (!edit) {
        await api.post('/api/finanzas/fuentes-pago', { nombre: nombre.trim(), tipo });
        toast.success('Fuente creada.');
      } else {
        await api.put(`/api/finanzas/fuentes-pago/${edit.id}`, { nombre: nombre.trim(), tipo, activo });
        toast.success('Fuente actualizada.');
      }
      close();
      await fetchAll();
    } catch (e) {
      toast.error(e?.error || 'No se pudo guardar.');
    }
  };

  const desactivar = async (r) => {
    try {
      await api.del(`/api/finanzas/fuentes-pago/${r.id}`);
      toast.success('Fuente desactivada.');
      await fetchAll();
    } catch (e) {
      toast.error(e?.error || 'No se pudo desactivar.');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2, flexWrap:'wrap' }}>
          <Typography variant="h6" fontWeight={800}>Catálogo – Fuentes de Pago</Typography>
          <Button variant="contained" onClick={openCreate}>Nueva fuente</Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Aquí defines de dónde salió el dinero (banco/caja/tarjeta). Se usa en pagos y reversas para auditoría.
        </Typography>

        <Box sx={{ mt: 2, overflowX:'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Activo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows || []).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell><Chip size="small" label={r.tipo} /></TableCell>
                  <TableCell>
                    {r.activo ? <Chip size="small" color="success" label="Activo" /> : <Chip size="small" label="Inactivo" />}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
                    <Button size="small" color="inherit" disabled={!r.activo || r.nombre === 'NO ESPECIFICADO'} onClick={() => desactivar(r)}>
                      Desactivar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color:'text.secondary' }}>
                    {loading ? 'Cargando…' : 'Sin datos'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{edit ? 'Editar fuente' : 'Nueva fuente'}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Nombre"
            fullWidth
            sx={{ mt: 1 }}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <TextField
            select
            label="Tipo"
            fullWidth
            sx={{ mt: 2 }}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>

          {edit && (
            <TextField
              select
              label="Activo"
              fullWidth
              sx={{ mt: 2 }}
              value={activo ? 'true' : 'false'}
              onChange={(e) => setActivo(e.target.value === 'true')}
            >
              <MenuItem value="true">Activo</MenuItem>
              <MenuItem value="false">Inactivo</MenuItem>
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} color="inherit">Cancelar</Button>
          <Button onClick={save} variant="contained" disabled={!canSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
