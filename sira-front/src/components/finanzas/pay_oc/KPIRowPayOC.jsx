// C:\SIRA\sira-front\src\components\finanzas\pay_oc\KPIRowPayOC.jsx
import React from 'react';
import { Grid } from '@mui/material';
import KPICardPayOC from './KPICardPayOC';
import ApprovalIcon from '@mui/icons-material/Approval';
import BoltIcon from '@mui/icons-material/Bolt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { amber, blue, deepOrange } from '@mui/material/colors';

export default function KPIRowPayOC({ kpiData }) {
  const {
    porAutorizar = 0, confirmarSpei = 0, pendienteLiquidar = 0,
    porAutorizarMonto = 0, confirmarSpeiMonto = 0, pendienteLiquidarMonto = 0,
  } = kpiData || {};

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={4}>
        <KPICardPayOC title="Órdenes por Autorizar" value={porAutorizar} amount={porAutorizarMonto} icon={<ApprovalIcon />} color={amber[600]} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <KPICardPayOC title="SPEI por Confirmar" value={confirmarSpei} amount={confirmarSpeiMonto} icon={<BoltIcon />} color={blue[600]} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <KPICardPayOC title="Pendientes de Liquidar (Nacionales)" value={pendienteLiquidar} amount={pendienteLiquidarMonto} icon={<ReceiptLongIcon />} color={deepOrange[500]} />
      </Grid>
    </Grid>
  );
}
