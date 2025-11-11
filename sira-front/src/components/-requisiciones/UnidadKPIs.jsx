// sira-front/src/components/-requisiciones/UnidadKPIs.jsx
import React, { useMemo } from 'react';
import { Grid } from '@mui/material';
// Usamos el KPICard que ya existe en la carpeta REC_OC
import KPICard from '../REC_OC/KPICard'; 
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BuildIcon from '@mui/icons-material/Build';
import WarningIcon from '@mui/icons-material/Warning';

export default function UnidadKPIs({ unidades }) {
  
  const kpis = useMemo(() => {
    const totalUnidades = unidades.length;
    const enServicio = unidades.reduce((acc, u) => acc + (parseInt(u.requisiciones_abiertas, 10) > 0 ? 1 : 0), 0);
    // TODO: Lógica para "Próximo Servicio" cuando tengamos el dato de KM
    const proximoServicio = unidades.filter(u => 
      u.km_proximo_servicio && u.km && (u.km_proximo_servicio - u.km < 1000)
    ).length;

    return { totalUnidades, enServicio, proximoServicio };
  }, [unidades]);

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={4}>
        <KPICard 
          title="Unidades Totales" 
          value={kpis.totalUnidades} 
          icon={<DirectionsCarIcon />} 
          color="#1976d2" 
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <KPICard 
          title="En Servicio / Req. Abierta" 
          value={kpis.enServicio} 
          icon={<BuildIcon />} 
          color="#f57c00" 
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <KPICard 
          title="Próximo Servicio (<1000km)" 
          value={kpis.proximoServicio} 
          icon={<WarningIcon />} 
          color="#d32f2f" 
        />
      </Grid>
    </Grid>
  );
}