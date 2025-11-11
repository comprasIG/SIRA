// sira-front/src/components/-requisiciones/ModalVerHistorial.jsx
import React, { useEffect } from 'react';
import {
  Modal, Box, Typography, Stack, Button, CircularProgress,
  List, ListItem, ListItemText, Divider, Paper, Chip
} from '@mui/material';
import { useUnidadHistorial } from '../../hooks/useUnidadHistorial';
import dayjs from 'dayjs';

// ... (styleModal y formatFecha se quedan igual) ...
const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 700,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
};

const formatFecha = (fecha) => {
  return dayjs(fecha).format('DD/MMM/YYYY [a las] hh:mm A');
};

export default function ModalVerHistorial({ open, onClose, unidad }) {
  const { historial, loading, fetchHistorial } = useUnidadHistorial();

  // 2. Cuando el modal se abre...
  useEffect(() => {
    // ==========================================================
    // ¡AQUÍ ESTÁ LA CORRECCIÓN!
    // Le pasamos 'unidad.proyecto_id' (ej. 10) 
    // en lugar de 'unidad.id' (ej. 1)
    // ==========================================================
    if (open && unidad?.proyecto_id) {
      fetchHistorial(unidad.proyecto_id);
    }
  }, [open, unidad, fetchHistorial]);
  
  // ... (El resto del return (JSX) se queda exactamente igual) ...
  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6" component="h2">
          Bitácora de Mantenimiento
        </Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>
        
        <Paper variant="outlined" sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '60vh', p: 2, mt: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : historial.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: 'center' }}>
              No hay registros en la bitácora para esta unidad.
            </Typography>
          ) : (
            <List disablePadding>
              {historial.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <Divider sx={{ my: 1.5 }} />}
                  <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Chip label={item.evento_nombre} color="info" size="small" variant="outlined" />
                          <Typography variant="caption" color="text.secondary">
                            {formatFecha(item.fecha)}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                          <Typography component="span" variant="body2" color="text.primary">
                            {item.descripcion}
                          </Typography>
                          <Typography component="span" variant="body2" color="text.secondary">
                            KM: {item.kilometraje.toLocaleString('es-MX')}
                          </Typography>
                          {item.costo_total > 0 && (
                            <Typography component="span" variant="body2" color="text.secondary">
                              Costo: ${parseFloat(item.costo_total).toFixed(2)} {item.numero_oc ? `(OC: ${item.numero_oc})` : ''}
                            </Typography>
                          )}
                          {item.numeros_serie && (
                            <Typography component="span" variant="body2" color="text.secondary">
                              Series: {item.numeros_serie}
                            </Typography>
                          )}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
                            Registrado por: {item.usuario_nombre || 'Sistema'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>

        <Stack direction="row" justifyContent="flex-end" sx={{ pt: 3 }}>
          <Button variant="contained" onClick={onClose}>Cerrar</Button>
        </Stack>
      </Box>
    </Modal>
  );
}