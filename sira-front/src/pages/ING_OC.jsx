// sira-front/src/pages/ING_OC.jsx
import React from 'react';
import ING_OCForm from '../components/ING_OC/ING_OCForm'; // Asumiendo que crearás este
import { Typography, Box } from '@mui/material';

export default function ING_OC() {
  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: 'bold' }}>
        Ingreso de Órdenes de Compra
      </Typography>
      <ING_OCForm />
    </Box>
  );
}