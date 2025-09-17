// C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\KPICardPayOC.jsx

import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

export default function KPICardPayOC({ title, value, icon, color }) {
  return (
    <Paper elevation={3} sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          width: 48, height: 48, borderRadius: 2,
          bgcolor: color || 'primary.main', color: 'white',
          display: 'grid', placeItems: 'center', fontSize: 28
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap>{title}</Typography>
        <Typography variant="h5" fontWeight="bold">{value}</Typography>
      </Box>
    </Paper>
  );
}
