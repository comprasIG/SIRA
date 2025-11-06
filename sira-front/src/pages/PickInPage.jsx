//C:\SIRA\sira-front\src\pages\PickInPage.jsx
import React from 'react';
import PICK_INForm from '../components/PICK_IN/PICK_INForm';
import { Typography, Box } from '@mui/material';

export default function PICK_IN() {
  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: 'bold' }}>
        Retiro de Material de Almacén
      </Typography>
      <PICK_INForm />
    </Box>
  );
}