import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';

/**
 * Muestra una fila de tarjetas para los KPIs principales del dashboard.
 *
 * @param {Object} props
 * @param {Object} props.kpiData - Objeto con los KPIs calculados.
 */
export default function KpiRow({ kpiData }) {
  const items = [
    { label: 'RFQs Activas', value: kpiData.rfqActivos || 0 },
    { label: 'OCs por Autorizar', value: kpiData.porAutorizar || 0 },
    { label: 'OCs en Proceso', value: kpiData.esperandoEntrega || 0 },
  ];
  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {items.map((item) => (
        <Grid item xs={12} sm={4} md={4} key={item.label}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}