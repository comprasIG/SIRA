// C:\SIRA\sira-front\src\components\ui\FullScreenLoader.jsx (VERSIÓN ATREVIDA)

import React from 'react';
import { Box, Typography, Backdrop } from '@mui/material';

export default function FullScreenLoader({ isOpen, message }) {
  if (!isOpen) {
    return null;
  }

  // Keyframes para la animación de pulso de las órbitas
  const keyframes = `
    @keyframes pulseOrbit {
      0% { stroke-opacity: 0.2; }
      50% { stroke-opacity: 0.6; }
      100% { stroke-opacity: 0.2; }
    }
  `;

  return (
    <Backdrop
      sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}
      open={isOpen}
    >
      <style>{keyframes}</style>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
          // ¡IMPORTANTE! Se establece el color primario del tema aquí
          // El SVG usará 'currentColor' para heredar este color.
          color: 'primary.main',
        }}
      >
        {/* --- INICIO DE LA ANIMACIÓN SVG ORBITAL --- */}
        <svg width="300" height="300" viewBox="0 0 400 400" aria-label="Procesando información">
          
          {/* Órbitas (Elipses con rotación y animación de pulso) */}
          <ellipse
            cx="200" cy="200" rx="180" ry="80"
            fill="none"
            stroke="currentColor" // Hereda el color primario
            strokeWidth="2"
            style={{
              animation: 'pulseOrbit 4s ease-in-out infinite',
            }}
          />
          <ellipse
            cx="200" cy="200" rx="180" ry="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            transform="rotate(60, 200, 200)" // Rotación diferente
            style={{
              animation: 'pulseOrbit 4s ease-in-out infinite',
              animationDelay: '-1s', // Desfase de animación
            }}
          />
          <ellipse
            cx="200" cy="200" rx="180" ry="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            transform="rotate(120, 200, 200)" // Rotación diferente
            style={{
              animation: 'pulseOrbit 4s ease-in-out infinite',
              animationDelay: '-2s', // Desfase de animación
            }}
          />

          {/* Paquetes de datos (Círculos que siguen las órbitas a diferentes velocidades) */}
          <circle cx="0" cy="0" r="8" fill="currentColor">
            <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
              <mpath xlinkHref="#orbit1" />
            </animateMotion>
          </circle>
          <circle cx="0" cy="0" r="8" fill="currentColor">
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
              <mpath xlinkHref="#orbit2" />
            </animateMotion>
          </circle>
          <circle cx="0" cy="0" r="8" fill="currentColor">
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
              <mpath xlinkHref="#orbit3" />
            </animateMotion>
          </circle>

          {/* Definición de los caminos para las animaciones (invisibles) */}
          <defs>
            <ellipse id="orbit1" cx="200" cy="200" rx="180" ry="80" />
            <ellipse id="orbit2" cx="200" cy="200" rx="180" ry="80" transform="rotate(60, 200, 200)" />
            <ellipse id="orbit3" cx="200" cy="200" rx="180" ry="80" transform="rotate(120, 200, 200)" />
          </defs>
        </svg>
        {/* --- FIN DE LA ANIMACIÓN SVG ORBITAL --- */}

        {message && (
          <Typography variant="h6" sx={{ color: 'white', letterSpacing: '1px' }}>
            {message}
          </Typography>
        )}
      </Box>
    </Backdrop>
  );
}