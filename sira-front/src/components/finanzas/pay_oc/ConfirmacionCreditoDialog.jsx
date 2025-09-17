// C:\SIRA\sira-front\src\components\finanzas\pay_oc\ConfirmacionCreditoDialog.jsx

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import Lottie from 'lottie-react';
import warningAnimation from '@/assets/lottie/warning.json'; // Descarga una animación de advertencia

export const ConfirmacionCreditoDialog = ({ open, onClose, onConfirm, diasCredito, fechaPago }) => {
    if (!open) return null;

    const fechaFormateada = new Date(fechaPago).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                Confirmar Aprobación de Crédito
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center' }}>
                <Lottie animationData={warningAnimation} style={{ width: 120, margin: 'auto' }} loop={false} />
                <Typography variant="body1" my={2}>
                    El proveedor ofrece <strong>{diasCredito || 0} días de crédito</strong>.
                </Typography>
                <Typography variant="h6">
                    La fecha de pago programada es el:<br/><strong>{fechaFormateada}</strong>.
                </Typography>
                <Typography variant="caption" color="text.secondary" mt={2}>
                    ¿Deseas continuar y aprobar la Orden de Compra?
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', p: 2 }}>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={onConfirm} variant="contained" color="success" autoFocus>
                    Sí, Aprobar
                </Button>
            </DialogActions>
        </Dialog>
    );
};