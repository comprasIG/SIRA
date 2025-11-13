// C:\SIRA\sira-front\src\components\ui\FullScreenLoader.jsx

import React, { useMemo } from 'react';
import { Box, Typography, Backdrop } from '@mui/material';
import Lottie from 'lottie-react';

// Importamos las animaciones Lottie (JSON) desde la carpeta loaders
import loaderCat from './loaders/Loader cat.json';
import paperplane from './loaders/Loading 40 _ Paperplane.json';
import walkingAvocado from './loaders/Walking Avocado.json';
import walkingOrange from './loaders/Walking Orange.json';
import virtualReality from './loaders/Virtual Reality.json';
import loadingElephant from './loaders/Loading.json';
import cuteDragon from './loaders/Cute dragon.json';
import manRobot from './loaders/Man and robot with computers sitting together in workplace.json';

// Colección de animaciones disponibles
const loaderAnimations = [
  loaderCat,
  paperplane,
  walkingAvocado,
  walkingOrange,
  virtualReality,
  loadingElephant,
  cuteDragon,
  manRobot,
];

export default function FullScreenLoader({ isOpen, message }) {
  // Elegimos una animación aleatoria cada vez que el loader se abre
  const selectedAnimation = useMemo(() => {
    if (!isOpen || loaderAnimations.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * loaderAnimations.length);
    return loaderAnimations[randomIndex];
  }, [isOpen]);

  if (!isOpen || !selectedAnimation) {
    return null;
  }

  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(10, 25, 41, 0.95)',
        backdropFilter: 'blur(3px)',
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
          maxWidth: '500px',
          maxHeight: '500px',
        }}
      >
        {/* Animación Lottie */}
        <Lottie
          animationData={selectedAnimation}
          loop
          autoplay
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {message && (
          <Typography
            variant="h6"
            sx={{ color: 'white', letterSpacing: '1px', textAlign: 'center' }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Backdrop>
  );
}
