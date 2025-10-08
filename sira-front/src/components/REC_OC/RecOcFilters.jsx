// src/components/REC_OC/RecOcFilters.jsx
import React, { useState, useEffect } from 'react';
import { Grid, TextField, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';
import useRecOcCatalogs from './hooks/useRecOcCatalogs';

export default function RecOcFilters({ onChange }) {
  const { proveedores, sitios, proyectos, loading } = useRecOcCatalogs();
  const [f, setF] = useState({ proveedor_id:'', sitio_id:'', proyecto_id:'', numero_oc:'' });

  useEffect(()=>{ onChange(f); /* eslint-disable-next-line */ }, [JSON.stringify(f)]);

  const reset = ()=> setF({ proveedor_id:'', sitio_id:'', proyecto_id:'', numero_oc:'' });

  if (loading) return null;

  return (
    <Grid container spacing={2} alignItems="flex-end">
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Proveedor</InputLabel>
          <Select label="Proveedor" value={f.proveedor_id} onChange={e=>setF(s=>({...s, proveedor_id:e.target.value}))}>
            <MenuItem value="">Todos</MenuItem>
            {proveedores.map(p=> <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Proyecto</InputLabel>
          <Select label="Proyecto" value={f.proyecto_id} onChange={e=>setF(s=>({...s, proyecto_id:e.target.value}))}>
            <MenuItem value="">Todos</MenuItem>
            {proyectos.map(p=> <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Sitio</InputLabel>
          <Select label="Sitio" value={f.sitio_id} onChange={e=>setF(s=>({...s, sitio_id:e.target.value}))}>
            <MenuItem value="">Todos</MenuItem>
            {sitios.map(s=> <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField fullWidth label="OC (buscar)" value={f.numero_oc} onChange={e=>setF(s=>({...s, numero_oc:e.target.value}))}/>
      </Grid>
      <Grid item xs={12} md={1}>
        <Button fullWidth variant="outlined" onClick={reset}>Reset</Button>
      </Grid>
    </Grid>
  );
}
