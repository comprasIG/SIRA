// C:\SIRA\sira-front\src\components\Dashboard\SSD\KPICard.jsx

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export default function KPICard({ title, value, icon, color = 'primary.main', sx = {} }) {
  return (
    <Card 
      variant="outlined" 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 2, 
        height: '100%',
        transition: 'box-shadow 0.3s',
        '&:hover': { 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
          cursor: 'pointer' 
        },
        ...sx 
      }}
    >
      <Box sx={{ 
        mr: 2, 
        p: 1.5, 
        backgroundColor: color, 
        borderRadius: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#fff'
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{value}</Typography>
        <Typography color="text.secondary" variant="body2">{title}</Typography>
      </Box>
    </Card>
  );
}
