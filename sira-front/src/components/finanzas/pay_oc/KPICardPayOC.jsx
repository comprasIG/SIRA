// C:\SIRA\sira-front\src\components\finanzas\pay_oc\KPICardPayOC.jsx

import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion'; // ✨ MEJORA: Importamos motion

export default function KPICardPayOC({ title, value, icon, color }) {
  return (
    // ✨ MEJORA: Envolvemos en motion.div para animaciones
    <motion.div whileHover={{ y: -5, scale: 1.03 }}>
      <Paper elevation={3} sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 52, height: 52, borderRadius: '12px',
            color: 'white',
            display: 'grid', placeItems: 'center',
            fontSize: 28,
            // ✨ MEJORA: Gradiente sutil en lugar de color plano
            background: `linear-gradient(45deg, ${color || '#1976d2'} 30%, ${color || '#2196f3'} 90%)`,
            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.4)'
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>{title}</Typography>
          <Typography variant="h5" fontWeight="bold">{value}</Typography>
        </Box>
      </Paper>
    </motion.div>
  );
}