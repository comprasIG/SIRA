// C:\SIRA\sira-front\src/components/finanzas/pay_oc/AutorizacionOCCard.jsx

import React from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip } from '@mui/material';
import CreditScoreIcon from '@mui/icons-material/CreditScore';

// Variante para la animación de entrada de cada tarjeta
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export const AutorizacionOCCard = ({ oc, onAprobarCredito }) => {
  const totalFormatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(oc.total);

  return (
    <motion.div variants={cardVariants}>
      <Paper 
        elevation={4}
        sx={{
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #e0e0e0'
        }}
      >
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              {oc.numero_oc}
            </Typography>
            <Chip label={oc.proyecto_nombre} color="primary" size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {oc.proveedor_razon_social}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="h4" fontWeight="bold" color="primary" textAlign="center" my={2}>
            {totalFormatted}
          </Typography>
          <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
            Monto Total (IVA incluido)
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="contained" 
              color="success" 
              startIcon={<CreditScoreIcon />}
              onClick={() => onAprobarCredito(oc.id)}
            >
              Aprobar a Crédito
            </Button>
          </motion.div>
          {/* Aquí irán los otros botones de acción */}
        </Box>
      </Paper>
    </motion.div>
  );
};