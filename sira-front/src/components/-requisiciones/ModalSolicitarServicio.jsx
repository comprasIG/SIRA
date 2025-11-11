// sira-front/src/components/-requisiciones/ModalSolicitarServicio.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Autocomplete, Alert
} from '@mui/material';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import { toast } from 'react-toastify';
import dayjs from 'dayjs'; // Usamos dayjs para manejar fechas (es más ligero)

// Estilos del modal (puedes moverlo a un archivo central si quieres)
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

// Este mapa traduce el TIPO DE EVENTO (de la bitácora) al SKU (del catálogo de compras)
// Esto es crucial para que Compras pueda cotizarlo.
const SKU_MAP = {
  'SERVICIO_PREV': 'SERV-VEH-PREV',
  'SERVICIO_CORR': 'SERV-VEH-CORR',
  'LLANTAS': 'LLANTA-GEN',
  'COMBUSTIBLE': 'COMBUS-GEN',
};

export default function ModalSolicitarServicio({ open, onClose, unidad, onReqCreada }) {
  // 1. Obtenemos los datos (tipos de evento) y la función para crear la req
  const { datosModal, loadingDatosModal, isSubmitting, crearRequisicion } = useUnidadServicios();

  // 2. Estado local del formulario
  const [eventoTipo, setEventoTipo] = useState(null);
  const [kilometraje, setKilometraje] = useState('');
  const [descripcion, setDescripcion] = useState('');
  // Ponemos la fecha requerida 3 días en el futuro por defecto
  const [fechaRequerida, setFechaRequerida] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));

  // 3. Reseteamos el formulario cada vez que la unidad cambia (al abrir)
  useEffect(() => {
    if (unidad) {
      setEventoTipo(null);
      setDescripcion('');
      setKilometraje(unidad.km || ''); // Rellenamos el último KM conocido
      setFechaRequerida(dayjs().add(3, 'day').format('YYYY-MM-DD'));
    }
  }, [unidad, open]);

  // 4. Lógica de envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);

    // --- Validaciones ---
    if (!eventoTipo) {
      toast.error('Por favor, selecciona un tipo de servicio.');
      return;
    }
    if (!kmNum || kmNum <= 0) {
      toast.error('El kilometraje es obligatorio.');
      return;
    }
    if (kmNum < unidad.km) {
      toast.error(`El kilometraje no puede ser menor al último registrado (${unidad.km} km).`);
      return;
    }
    if (!fechaRequerida) {
      toast.error('La fecha requerida es obligatoria.');
      return;
    }
    
    // Mapeamos el código del evento (ej. 'SERVICIO_PREV') al SKU de material (ej. 'SERV-VEH-PREV')
    const materialSku = SKU_MAP[eventoTipo.codigo];
    if (!materialSku) {
      toast.error(`Error de configuración: El tipo de evento "${eventoTipo.codigo}" no tiene un material SKU asociado.`);
      return;
    }

    // 5. Construimos el payload para la API
    const payload = {
      proyecto_id: unidad.proyecto_id, // Es el ID del "proyecto espejo"
      sitio_id: unidad.sitio_id,     // Es el ID del sitio "UNIDADES"
      kilometraje: kmNum,
      evento_tipo_id: eventoTipo.id,
      material_sku: materialSku,
      descripcion: descripcion,
      fecha_requerida: fechaRequerida,
    };

    // 6. Llamamos al hook
    const exito = await crearRequisicion(payload);
    if (exito) {
      onReqCreada(); // Refresca la lista de unidades
      onClose();     // Cierra el modal
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
                options={datosModal.tiposDeEvento || []}
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
                helperText={`Último registro: ${unidad?.km || 0} km`}
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