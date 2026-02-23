// sira-front/src/components/-requisiciones/ModalSolicitarServicio.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Autocomplete, Alert,
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

export default function ModalSolicitarServicio({ open, onClose, unidad, onReqCreada }) {
  const { eventoTipos, loadingEventoTipos, isSubmitting, crearRequisicion } = useUnidadServicios();

  const [eventoTipo, setEventoTipo] = useState(null);
  const [kilometraje, setKilometraje] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));

  useEffect(() => {
    if (unidad) {
      setEventoTipo(null);
      setDescripcion('');
      setKilometraje(typeof unidad.km === 'number' ? unidad.km : '');
      setFechaRequerida(dayjs().add(3, 'day').format('YYYY-MM-DD'));
    }
  }, [unidad, open]);

  // Filtramos los tipos que generan requisición y que aplican al tipo de combustible de la unidad.
  // tipo_combustible_aplica === null significa que aplica a todos.
  const tiposServicio = useMemo(() => {
    return eventoTipos.filter(t => {
      if (!t.genera_requisicion) return false;
      if (!t.tipo_combustible_aplica) return true; // aplica a todos
      return t.tipo_combustible_aplica?.toUpperCase() === unidad?.tipo_combustible?.toUpperCase();
    });
  }, [eventoTipos, unidad]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);

    if (!eventoTipo) { toast.error('Selecciona un tipo de servicio.'); return; }
    if (!kmNum && kmNum !== 0) { toast.error('El kilometraje es obligatorio.'); return; }
    if (typeof unidad.km === 'number' && kmNum < unidad.km) {
      toast.error(`El kilometraje no puede ser menor al último registrado (${unidad.km} km).`);
      return;
    }
    if (!fechaRequerida) { toast.error('La fecha requerida es obligatoria.'); return; }

    const payload = {
      unidad_id:      unidad.id,
      proyecto_id:    unidad.proyecto_id,
      sitio_id:       unidad.sitio_id,
      kilometraje:    kmNum,
      evento_tipo_id: eventoTipo.id,
      descripcion,
      fecha_requerida: fechaRequerida,
    };

    const exito = await crearRequisicion(payload);
    if (exito) { onReqCreada?.(); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6">Solicitar Servicio para:</Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>
        {unidad?.tipo_combustible && (
          <Typography variant="caption" color="text.secondary">
            Combustible: {unidad.tipo_combustible}
          </Typography>
        )}

        {loadingEventoTipos ? <CircularProgress sx={{ display: 'block', mt: 2 }} /> : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5} sx={{ mt: 2 }}>

              <Autocomplete
                options={tiposServicio}
                getOptionLabel={(o) => o.nombre}
                value={eventoTipo}
                onChange={(_, v) => setEventoTipo(v)}
                noOptionsText="No hay tipos de servicio para este combustible"
                renderInput={(params) => (
                  <TextField {...params} label="Tipo de Servicio" required />
                )}
              />

              {eventoTipo?.km_intervalo && (
                <Alert severity="info" variant="outlined" sx={{ fontSize: '0.82rem' }}>
                  Este servicio tiene un intervalo de <strong>{Number(eventoTipo.km_intervalo).toLocaleString('es-MX')} km</strong>.
                  El próximo servicio se programará automáticamente.
                </Alert>
              )}

              <TextField
                label="Kilometraje Actual"
                type="number"
                required
                fullWidth
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                helperText={`Último registro: ${typeof unidad?.km === 'number' ? unidad.km.toLocaleString('es-MX') : 'N/A'} km`}
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
                placeholder="Describe la falla o detalles del servicio..."
              />

              <Alert severity="info" variant="outlined" sx={{ fontSize: '0.82rem' }}>
                Se creará una requisición que pasará por el flujo de aprobación (VB_REQ) y cotización.
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 1 }}>
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
