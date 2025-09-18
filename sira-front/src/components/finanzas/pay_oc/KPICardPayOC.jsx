// C:\SIRA\sira-front\src\components\finanzas\pay_oc\KPICardPayOC.jsx

import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';

export default function KPICardPayOC({ title, value = 0, amount = 0, icon, color }) {
  const amountFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
  return (
    <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <div style={{
          width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color || '#1976d2', color: 'white'
        }}>
          {icon}
        </div>
        <div>
          <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
          <Typography variant="h5" fontWeight={800}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{amountFmt}</Typography>
        </div>
      </Stack>
    </Paper>
  );
}
