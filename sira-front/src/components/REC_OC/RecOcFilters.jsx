// src/components/REC_OC/RecOcFilters.jsx
import React, { useState, useEffect } from 'react';
import {
  Grid, TextField, FormControl, InputLabel, Select, MenuItem, Button,
  CircularProgress
} from '@mui/material';
import useRecOcCatalogs from './hooks/useRecOcCatalogs';

export default function RecOcFilters({ onChange }) {
  // Defaults seguros: si el hook aún no cargó, usamos []
  const {
    proveedores = [],
    sitios = [],
    proyectos = [],
    loading = false,
  } = useRecOcCatalogs();

  const [f, setF] = useState({
    proveedor_id: '',
    sitio_id: '',
    proyecto_id: '',
    numero_oc: '',
  });

  // Empuja cambios al padre
  useEffect(() => {
    onChange?.(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(f)]);

  const reset = () =>
    setF({ proveedor_id: '', sitio_id: '', proyecto_id: '', numero_oc: '' });

  if (loading) {
    return (
      <Grid container justifyContent="center" sx={{ py: 3 }}>
        <CircularProgress />
      </Grid>
    );
  }

  const safeProveedores = Array.isArray(proveedores) ? proveedores : [];
  const safeProyectos = Array.isArray(proyectos) ? proyectos : [];
  const safeSitios = Array.isArray(sitios) ? sitios : [];

  return (
    <Grid container spacing={2} alignItems="flex-end">
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Proveedor</InputLabel>
          <Select
            label="Proveedor"
            value={f.proveedor_id}
            onChange={(e) => setF((s) => ({ ...s, proveedor_id: e.target.value }))}
          >
            <MenuItem value="">Todos</MenuItem>
            {safeProveedores.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Proyecto</InputLabel>
          <Select
            label="Proyecto"
            value={f.proyecto_id}
            onChange={(e) => setF((s) => ({ ...s, proyecto_id: e.target.value }))}
          >
            <MenuItem value="">Todos</MenuItem>
            {safeProyectos.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Sitio</InputLabel>
          <Select
            label="Sitio"
            value={f.sitio_id}
            onChange={(e) => setF((s) => ({ ...s, sitio_id: e.target.value }))}
          >
            <MenuItem value="">Todos</MenuItem>
            {safeSitios.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={2}>
        <TextField
          fullWidth
          label="OC (buscar)"
          value={f.numero_oc}
          onChange={(e) => setF((s) => ({ ...s, numero_oc: e.target.value }))}
        />
      </Grid>

      <Grid item xs={12} md={1}>
        <Button fullWidth variant="outlined" onClick={reset}>
          Reset
        </Button>
      </Grid>
    </Grid>
  );
}
