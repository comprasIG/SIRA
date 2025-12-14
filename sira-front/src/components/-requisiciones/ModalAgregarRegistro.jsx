// sira-front/src/components/-requisiciones/ModalAgregarRegistro.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Autocomplete, Alert
} from '@mui/material';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import { toast } from 'react-toastify';

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

const TIPOS_MANUALES = ['INCIDENCIA', 'OTRO', 'COMBUSTIBLE'];

export default function ModalAgregarRegistro({ open, onClose, unidad, onRegistroCreado }) {
  const { datosModal, loadingDatosModal, isSubmitting, agregarRegistroManual } = useUnidadServicios();

  const tiposDeEventoManuales = useMemo(() => {
    return datosModal.tiposDeEvento.filter(tipo => TIPOS_MANUALES.includes(tipo.codigo));
  }, [datosModal.tiposDeEvento]);

  const [eventoTipo, setEventoTipo] = useState(null);
  const [kilometraje, setKilometraje] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [costoTotal, setCostoTotal] = useState('');
  const [numerosSerie, setNumerosSerie] = useState('');

  useEffect(() => {
    if (unidad) {
      setEventoTipo(null);
      setDescripcion('');
      // ======== ¡CORRECCIÓN! Usamos unidad.km (con typeof) para mostrar 0km ========
      setKilometraje((typeof unidad.km === 'number') ? unidad.km : '');
      // =========================================================================
      setCostoTotal('');
      setNumerosSerie('');
    }
  }, [unidad, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);

    if (!eventoTipo) {
      toast.error('Por favor, selecciona un tipo de evento.');
      return;
    }
    if (!kmNum && kmNum !== 0) {
      toast.error('El kilometraje es obligatorio.');
      return;
    }
    if (typeof unidad.km === 'number' && kmNum < unidad.km) {
      toast.error(`El kilometraje no puede ser menor al último registrado (${unidad.km} km).`);
      return;
    }
    if (!descripcion.trim()) {
      toast.error('La descripción es obligatoria.');
      return;
    }

    // ==========================================================
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE! ---
    // Enviamos el 'unidad.id' real
    // ==========================================================
    const payload = {
      unidad_id: unidad.id, // <<< CORREGIDO
      evento_tipo_id: eventoTipo.id,
      kilometraje: kmNum,
      descripcion: descripcion,
      costo_total: costoTotal || 0,
      numeros_serie: numerosSerie || null,
    };
    // ==========================================================

    const exito = await agregarRegistroManual(payload);
    if (exito) {
      onRegistroCreado(); 
      onClose();     
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6" component="h2">
          Agregar Registro Manual:
        </Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>
        
        {loadingDatosModal ? <CircularProgress /> : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              
              <Autocomplete
                options={tiposDeEventoManuales}
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
                label="Descripción del Evento"
                multiline
                rows={3}
                fullWidth
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe la incidencia, carga de gasolina, o el registro manual..."
              />
              
              <TextField
                label="Costo Total (Opcional)"
                type="number"
                fullWidth
                value={costoTotal}
                onChange={(e) => setCostoTotal(e.target.value)}
                helperText="Si el evento tuvo un costo (ej. gasolina), ingrésalo aquí."
              />
              
              <TextField
                label="Números de Serie (Opcional)"
                fullWidth
                value={numerosSerie}
                onChange={(e) => setNumerosSerie(e.target.value)}
                helperText="Para llantas, baterías, etc."
              />

              <Alert severity="warning" variant="outlined" sx={{ fontSize: '0.85rem' }}>
                Esto agregará un registro directo a la bitácora. **No generará una requisición** ni un proceso de compra.
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
                </Button>
              </Stack>

            </Stack>
          </Box>
        )}
      </Box>
    </Modal>
  );
}