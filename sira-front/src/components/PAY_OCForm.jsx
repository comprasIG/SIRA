// C:\SIRA\SIRA\sira-front\src\components\PAY_OCForm.jsx

import React from 'react';
import { useAutorizaciones } from './finanzas/pay_oc/useAutorizaciones';
import { AutorizacionOCCard } from './finanzas/pay_oc/AutorizacionOCCard';
import { Box, Typography, Container } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import loadingAnimation from '@/assets/lottie/loading.json';
import emptyAnimation from '@/assets/lottie/payment_sucess.json'; 

// Variante para la animación del contenedor de las tarjetas
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1 // Esto hace que las tarjetas aparezcan una tras otra
    }
  }
};

export default function PAY_OC() {
    const { ocs, loading, error, aprobarCredito } = useAutorizaciones();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Lottie animationData={loadingAnimation} style={{ width: 200 }} />
            </Box>
        );
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold">
                Autorización de Pagos
            </Typography>

            <AnimatePresence>
                {ocs.length > 0 ? (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '24px'
                        }}
                    >
                        {ocs.map(oc => (
                            <AutorizacionOCCard 
                                key={oc.id}
                                oc={oc} 
                                onAprobarCredito={aprobarCredito} 
                            />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Box sx={{ textAlign: 'center', mt: 8 }}>
                            <Lottie animationData={emptyAnimation} style={{ width: 300, margin: 'auto' }} />
                            <Typography variant="h6" color="text.secondary" mt={2}>
                                ¡Excelente! No hay pagos pendientes por autorizar.
                            </Typography>
                        </Box>
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
}