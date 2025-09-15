//C:\SIRA\sira-front\src\components\ui\FullScreenLoader.jsx
/**
 * =================================================================================================
 * COMPONENTE: FullScreenLoader
 * =================================================================================================
 * @file FullScreenLoader.jsx
 * @description Un componente reutilizable que muestra una superposición de carga en
 * toda la pantalla. Es ideal para bloquear la interacción del usuario durante
 * procesos asíncronos críticos.
 *
 * @props {boolean} isOpen - Controla si el loader está visible o no.
 * @props {string} [message] - Un mensaje opcional para mostrar debajo del spinner.
 */
import React from 'react';
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material';

export default function FullScreenLoader({ isOpen, message }) {
  if (!isOpen) {
    return null;
  }

  return (
    // Backdrop es un componente de MUI que proporciona un fondo semitransparente.
    <Backdrop
      // --- ¡LA CORRECCIÓN ESTÁ AQUÍ! ---
      // Cambiamos 'theme.zIndex.drawer' por 'theme.zIndex.modal'.
      // Esto asegura que el Backdrop (loader) siempre tenga un z-index
      // un nivel más alto que cualquier Dialog (modal) abierto.
      sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}
      open={isOpen}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2, // Espacio entre el spinner y el texto
        }}
      >
        <CircularProgress color="inherit" />
        {message && (
          <Typography variant="h6">{message}</Typography>
        )}
      </Box>
    </Backdrop>
  );
}