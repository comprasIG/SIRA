// sira-front/src/pages/REC_OC.jsx
import React from 'react';
import REC_OCForm from '../components/REC_OC/REC_OCForm';
import { Typography, Box } from '@mui/material';

export default function REC_OC() {
  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: 'bold' }}>
        Recolección de Órdenes de Compra
      </Typography>
      <REC_OCForm />
    </Box>
  );
}