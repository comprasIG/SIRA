// sira-front/src/components/REC_OC/ModalCerrarServicio.jsx
import React, { useState } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Alert
} from '@mui/material';
import { toast } from 'react-toastify';

const styleModal = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%', maxWidth: 500, bgcolor: 'background.paper',
  boxShadow: 24, p: 4, borderRadius: 2,
};

export default function ModalCerrarServicio({ open, onClose, oc, onSubmit }) {
  const [kilometraje, setKilometraje] = useState('');
  const [numerosSerie, setNumerosSerie] = useState('');
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);
    
    if (!kmNum || kmNum <= 0) {
      toast.error('El kilometraje final es obligatorio.');
      return;
    }

    const payload = {
      kilometraje_final: kmNum,
      numeros_serie: numerosSerie,
      comentario_cierre: comentario,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(oc.id, payload);
      onClose(); // Cierra el modal solo si tiene éxito
    } catch (error) {
      // El error ya se muestra (toast) desde el hook
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reseteamos el form si se cierra
  const handleClose = () => {
    setKilometraje('');
    setNumerosSerie('');
    setComentario('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={styleModal}>
        <Typography variant="h6" component="h2">
          Confirmar Servicio y Cerrar OC
        </Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {oc.numero_oc}
        </Typography>
        <Typography variant="body2" gutterBottom>
          Proveedor: {oc.proveedor_marca}
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5} sx={{ mt: 2 }}>
            
            <TextField
              label="Kilometraje Final"
              type="number"
              required
              fullWidth
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              helperText="Kilometraje de la unidad al recibir el servicio."
            />

            <TextField
              label="Números de Serie (Opcional)"
              multiline
              rows={2}
              fullWidth
              value={numerosSerie}
              onChange={(e) => setNumerosSerie(e.target.value)}
              placeholder="Escribe aquí los números de serie de llantas, batería, etc."
            />

            <TextField
              label="Comentario de Cierre (Opcional)"
              multiline
              rows={2}
              fullWidth
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Notas finales sobre el servicio."
            />
            
            <Alert severity="info" variant="outlined" sx={{ fontSize: '0.85rem' }}>
              Al confirmar, la OC se marcará como "ENTREGADA" y se creará el registro final en la bitácora del vehículo.
            </Alert>

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button onClick={handleClose} disabled={isSubmitting}>Cancelar</Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isSubmitting ? 'Cerrando...' : 'Confirmar y Cerrar'}
              </Button>
            </Stack>

          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}