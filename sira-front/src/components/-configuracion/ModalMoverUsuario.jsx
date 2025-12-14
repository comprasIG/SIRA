// sira-front/src/components/-configuracion/ModalMoverUsuario.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Stack, Button,
  CircularProgress, Autocomplete, TextField, Alert
} from '@mui/material';
import { toast } from 'react-toastify';

// Estilos del modal
const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 450,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

export default function ModalMoverUsuario({ 
  open, 
  onClose, 
  usuario,          // El usuario que estamos moviendo (ej. { id: 5, nombre: 'Agustín' })
  rolActual,        // El rol en el que está actualmente (ej. { id: 2, nombre: 'Ventas' })
  listaDeRoles,     // La lista completa de todos los roles para el dropdown
  onSubmit,         // La función del hook (cambiarRolUsuario)
  isSubmitting 
}) {
  
  const [nuevoRol, setNuevoRol] = useState(null);

  // Cuando el modal se abre, pre-seleccionamos el rol actual del usuario en el dropdown
  useEffect(() => {
    if (rolActual) {
      setNuevoRol(rolActual);
    }
  }, [rolActual, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuevoRol || nuevoRol.id === rolActual.id) {
      toast.error('Debes seleccionar un rol nuevo al que mover el usuario.');
      return;
    }

    // Llamamos a la función 'onSubmit' (que es 'cambiarRolUsuario' del hook)
    const exito = await onSubmit(usuario.id, nuevoRol.id);
    if (exito) {
      onClose(); // Cierra el modal solo si tiene éxito
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6" component="h2">
          Mover Usuario de Rol
        </Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {usuario?.nombre}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Rol Actual: <strong>{rolActual?.nombre}</strong>
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5} sx={{ mt: 2 }}>
            
            <Autocomplete
              options={listaDeRoles}
              getOptionLabel={(option) => option.nombre || ''}
              value={nuevoRol}
              onChange={(e, newValue) => setNuevoRol(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Selecciona el Nuevo Rol" required />
              )}
            />

            <Alert severity="info" variant="outlined" sx={{ fontSize: '0.85rem' }}>
              Al guardar, el usuario perderá todos los permisos de su rol actual y recibirá los permisos del nuevo rol.
            </Alert>

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={isSubmitting || !nuevoRol || nuevoRol?.id === rolActual?.id}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isSubmitting ? 'Moviendo...' : 'Mover Usuario'}
              </Button>
            </Stack>

          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}