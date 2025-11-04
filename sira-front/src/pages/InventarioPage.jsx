// sira-front/src/pages/InventarioPage.jsx
import React from 'react';
import InventarioForm from '../components/almacen/InventarioForm'; // Apunta a la nueva ubicación
import { Typography, Box } from '@mui/material';

export default function InventarioPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: 'bold' }}>
        Consulta de Inventario
      </Typography>
      {/* Renderiza el componente principal del inventario */}
      <InventarioForm />
    </Box>
  );
}