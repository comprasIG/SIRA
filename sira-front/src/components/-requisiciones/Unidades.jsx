// src/components/-requisiciones/Unidades.jsx
///src/components/-requisiciones/Unidades.jsx
import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useUnidades } from '../../hooks/useUnidades'; // 1. Importamos el hook

export default function Unidades() {
  // 2. Usamos el hook para llamar a la API
  const { unidades, loading } = useUnidades();

  // 3. Mostramos un 'cargando' mientras la API responde
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 4. Esta es la prueba de fuego
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard de Unidades (Prueba de API)
      </Typography>
      
      <Typography gutterBottom>
        Si ves un JSON aquí abajo, ¡la API (`/api/unidades`) y las migraciones funcionaron!
      </Typography>

      <Paper sx={{ p: 2, background: '#f5f5f5', overflowX: 'auto' }}>
        <pre>
          {JSON.stringify(unidades, null, 2)}
        </pre>
      </Paper>
    </Box>
  );
}