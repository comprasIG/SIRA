// C:\SIRA\sira-front\src\components\Dashboard\SSD\DashboardKPIRow.jsx

import React from 'react';
import { Grid } from '@mui/material';
import KPICard from './KPICard';

// Importa los íconos que usarás
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ApprovalIcon from '@mui/icons-material/Approval';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { amber, green, blue } from '@mui/material/colors';

export default function DashboardKPIRow({ kpiData }) {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={4}>
        <KPICard
          title="Total RFQs Activos"
          value={kpiData.rfqActivos}
          icon={<ShoppingCartIcon />}
          color={blue[500]}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <KPICard
          title="Órdenes por Autorizar"
          value={kpiData.porAutorizar}
          icon={<ApprovalIcon />}
          color={amber[500]}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <KPICard
          title="Esperando Entrega"
          value={kpiData.esperandoEntrega}
          icon={<LocalShippingIcon />}
          color={green[500]}
        />
      </Grid>
    </Grid>
  );
}