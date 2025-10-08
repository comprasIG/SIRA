// src/components/REC_OC/RecOcKPIs.jsx
import React from 'react';
import { Grid, Card, CardContent, Typography, Button } from '@mui/material';
import useRecOcList from './hooks/useRecOcList';

export default function RecOcKPIs({ onCancelarClick, reload }) {
  const { ocs: pend, loading: lp } = useRecOcList({}, reload, 'pendientes');
  const { ocs: proc, loading: lq } = useRecOcList({}, reload, 'en-proceso');

  const k = (v, l) => (l ? '—' : v.length);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card variant="outlined"><CardContent>
          <Typography variant="overline">Pendientes</Typography>
          <Typography variant="h4">{k(pend, lp)}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card variant="outlined"><CardContent>
          <Typography variant="overline">En recolección</Typography>
          <Typography variant="h4">{k(proc, lq)}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid item xs={12} md={4} sx={{display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
        <Button color="error" variant="contained" onClick={onCancelarClick}>
          Cancelar OC
        </Button>
      </Grid>
    </Grid>
  );
}
