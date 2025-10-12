// sira-front/src/components/REC_OC/KPICard.jsx
import React from 'react';
import { Paper, Stack, Typography, Box } from '@mui/material';

export default function KPICard({ title, value = 0, icon, color, comment }) {
  return (
    <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{
          width: 48, height: 48, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color || '#1976d2', color: 'white',
        }}>
          {icon}
        </Box>
        <div>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4" fontWeight={800}>{value}</Typography>
          {comment && <Typography variant="caption" color="text.secondary">{comment}</Typography>}
        </div>
      </Stack>
    </Paper>
  );
}