// C:\SIRA\sira-front\src\components\ui\FullScreenLoader.jsx (VERSIÓN FRAMER-MOTION PATH)

import React, { useMemo } from 'react';
import { Box, Typography, Backdrop } from '@mui/material';
import { motion } from 'framer-motion';

// --- Colección de íconos SVG minimalistas (viewBox y path data) ---
const icons = [
  { // Pirámide de Chichén Itzá
    viewBox: "0 0 100 100",
    path: "M50 10 L10 90 L90 90 L50 10 M10 90 L35 90 L35 70 L65 70 L65 90 L90 90 M45 40 L55 40 L55 55 L45 55 Z",
  },
  { // Cabeza de Jaguar
    viewBox: "0 0 24 24",
    path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H9.5v-1h7v1zm-2-3c0 .83-.67 1.5-1.5 1.5S11 9.33 11 8.5 11.67 7 12.5 7s1.5.67 1.5 1.5z",
  },
  { // Ajolote
    viewBox: "0 0 24 24",
    path: "M12 2c-3.14 0-6.14 1.29-8.49 3.51S0 10.86 0 14c0 3.31 2.69 6 6 6h12c3.31 0 6-2.69 6-6 0-3.14-1.29-6.14-3.51-8.49S15.14 2 12 2zm-4 12H7v-2h1v2zm8 0h-1v-2h1v2zm-4 0h-1v-2h1v2z",
  },
  { // Sol Azteca
    viewBox: "0 0 24 24",
    path: "M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-12h2v4h-2zm0 6h2v4h-2zM6.5 11l3 3-1.41 1.41-3-3zm11 4.41L16.09 14l3-3 1.41 1.41z",
  }
];

export default function FullScreenLoader({ isOpen, message }) {
  // Selecciona un ícono al azar cada vez que el loader se abre
  const selectedIcon = useMemo(() => {
    if (!isOpen) return null;
    const randomIndex = Math.floor(Math.random() * icons.length);
    return icons[randomIndex];
  }, [isOpen]);

  if (!isOpen || !selectedIcon) {
    return null;
  }

  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(10, 25, 41, 0.95)',
        backdropFilter: 'blur(3px)'
      }}
      open={isOpen}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
          width: '60vw',
          height: '60vh',
          maxWidth: '500px', // Limite para pantallas muy grandes
          maxHeight: '500px',
          color: 'primary.main', // El SVG heredará este color
        }}
      >
        {/* El componente SVG usa motion para animar el trazado del path */}
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={selectedIcon.viewBox}
          width="100%"
          height="100%"
        >
          <motion.path
            d={selectedIcon.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            // --- La Magia de Framer Motion ---
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse", // La animación irá de 0 a 1 y de 1 a 0
            }}
          />
        </motion.svg>
        
        {message && (
          <Typography variant="h6" sx={{ color: 'white', letterSpacing: '1px' }}>
            {message}
          </Typography>
        )}
      </Box>
    </Backdrop>
  );
}