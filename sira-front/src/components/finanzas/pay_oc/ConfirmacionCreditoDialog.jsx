// C:\SIRA\sira-front\src\components\finanzas\pay_oc\ConfirmacionCreditoDialog.jsx

import React, { useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, Box } from '@mui/material';
import Lottie from 'lottie-react';
import warningAnimation from '@/assets/lottie/warning.json';

const toYYYYMMDD = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

export const ConfirmacionCreditoDialog = ({ open, onClose, onConfirm, diasCredito, fechaPago, onChangeFechaPago }) => {
  if (!open) return null;

  const fechaValue = useMemo(() => toYYYYMMDD(fechaPago), [fechaPago]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
        Confirmar Aprobación de Crédito
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center' }}>
        <Lottie animationData={warningAnimation} style={{ width: 120, margin: 'auto' }} loop={false} />

        <Typography variant="body1" my={2}>
          El proveedor ofrece <strong>{diasCredito || 0} días de crédito</strong>.
        </Typography>

        <Box sx={{ mt: 2 }}>
          <TextField
            label="Fecha comprometida de pago"
            type="date"
            fullWidth
            value={fechaValue}
            onChange={(e) => onChangeFechaPago?.(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Puedes ajustar la fecha antes de aprobar."
          />
        </Box>

        <Typography variant="caption" color="text.secondary" mt={2} display="block">
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
