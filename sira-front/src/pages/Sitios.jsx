// C:\SIRA\sira-front\src\pages\Sitios.jsx
import React from 'react';
import Sitios from '../components/-p-m-o/Sitios';
import { Typography, Box } from '@mui/material';

export default function SitiosPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: 'bold' }}>
        SITIOS
      </Typography>
      <Sitios/>
    </Box>
  );
}