// sira-front/src/components/-requisiciones/ModalSolicitarServicio.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Autocomplete, Alert
} from '@mui/material';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const SKU_MAP = {
  'SERVICIO_PREV': 'SERV-VEH-PREV',
  'SERVICIO_CORR': 'SERV-VEH-CORR',
  'LLANTAS': 'LLANTA-GEN',
  'COMBUSTIBLE': 'COMBUS-GEN',
};

export default function ModalSolicitarServicio({ open, onClose, unidad, onReqCreada }) {
  const { datosModal, loadingDatosModal, isSubmitting, crearRequisicion } = useUnidadServicios();

  const [eventoTipo, setEventoTipo] = useState(null);
  const [kilometraje, setKilometraje] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));

  useEffect(() => {
    if (unidad) {
      setEventoTipo(null);
      setDescripcion('');
      // ======== ¡CORRECCIÓN! Usamos unidad.km (con typeof) para mostrar 0km ========
      setKilometraje((typeof unidad.km === 'number') ? unidad.km : '');
      // =========================================================================
      setFechaRequerida(dayjs().add(3, 'day').format('YYYY-MM-DD'));
    }
  }, [unidad, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);

    if (!eventoTipo) {
      toast.error('Por favor, selecciona un tipo de servicio.');
      return;
    }
    if (!kmNum && kmNum !== 0) { // Permitir 0
      toast.error('El kilometraje es obligatorio.');
      return;
    }
    // Permite que el KM sea igual, pero no menor
    if (typeof unidad.km === 'number' && kmNum < unidad.km) {
      toast.error(`El kilometraje no puede ser menor al último registrado (${unidad.km} km).`);
      return;
    }
    if (!fechaRequerida) {
      toast.error('La fecha requerida es obligatoria.');
      return;
    }
    
    const materialSku = SKU_MAP[eventoTipo.codigo];
    if (!materialSku) {
      toast.error(`Error de configuración: El tipo de evento "${eventoTipo.codigo}" no tiene un material SKU asociado.`);
      return;
    }

    // ==========================================================
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE! ---
    // Ahora enviamos 'unidad_id' (ID real de la unidad, ej: 1)
    // Y 'proyecto_id' (ID del proyecto espejo, ej: 10)
    // ==========================================================
    const payload = {
      unidad_id: unidad.id, // <<< LÍNEA AÑADIDA
      proyecto_id: unidad.proyecto_id, 
      sitio_id: unidad.sitio_id,     
      kilometraje: kmNum,
      evento_tipo_id: eventoTipo.id,
      material_sku: materialSku,
      descripcion: descripcion,
      fecha_requerida: fechaRequerida,
    };
    // ==========================================================

    const exito = await crearRequisicion(payload);
    if (exito) {
      onReqCreada(); 
      onClose();     
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6" component="h2">
          Solicitar Servicio para:
        </Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>
        
        {loadingDatosModal ? <CircularProgress /> : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              
              <Autocomplete
                options={datosModal.tiposDeEvento.filter(t => !TIPOS_MANUALES.includes(t.codigo)) || []} // Filtramos los que SÍ generan req
                getOptionLabel={(option) => option.nombre}
                value={eventoTipo}
                onChange={(e, newValue) => setEventoTipo(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Tipo de Evento" required />
                )}
              />

              <TextField
                label="Kilometraje Actual"
                type="number"
                required
                fullWidth
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                helperText={`Último registro: ${(typeof unidad?.km === 'number') ? unidad.km : 'N/A'} km`}
              />

              <TextField
                label="Fecha Requerida"
                type="date"
                required
                fullWidth
                value={fechaRequerida}
                onChange={(e) => setFechaRequerida(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Descripción / Comentarios"
                multiline
                rows={3}
                fullWidth
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe la falla, el servicio necesario o detalles adicionales..."
              />

              <Alert severity="info" variant="outlined" sx={{ fontSize: '0.85rem' }}>
                Esto creará una requisición que pasará al flujo de aprobación (`VB_REQ`) y cotización (`G_RFQ`).
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {isSubmitting ? 'Creando...' : 'Crear Requisición'}
                </Button>
              </Stack>

            </Stack>
          </Box>
        )}
      </Box>
    </Modal>
  );
}

// Re-definimos los tipos manuales aquí para el filtro del Autocomplete
const TIPOS_MANUALES = ['INCIDENCIA', 'OTRO', 'COMBUSTIBLE'];