// sira-front/src/components/dashboard/gasolina/ModalRegistrarCarga.jsx
/**
 * Modal para registrar una nueva carga de gasolina desde el dashboard FIN/SSD.
 * Crea simultáneamente:
 *   - un registro en fin_gasolina_cargas (flujo de pago)
 *   - un registro en unidades_historial (bitácora de la unidad)
 */
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button,
  CircularProgress, Autocomplete, Divider, Chip,
} from '@mui/material';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 520,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  maxHeight: '90vh',
  overflowY: 'auto',
};

export default function ModalRegistrarCarga({
  open, onClose, unidades, sitios, proyectos, isSubmitting, onSubmit,
}) {
  const [unidad,          setUnidad]          = useState(null);
  const [kilometraje,     setKilometraje]     = useState('');
  const [costoTotal,      setCostoTotal]      = useState('');
  const [sitioDestino,    setSitioDestino]    = useState(null);
  const [proyectoDestino, setProyectoDestino] = useState(null);
  const [descripcion,     setDescripcion]     = useState('');

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setUnidad(null);
      setKilometraje('');
      setCostoTotal('');
      setSitioDestino(null);
      setProyectoDestino(null);
      setDescripcion('');
    }
  }, [open]);

  // Pre-fill km desde la unidad seleccionada
  useEffect(() => {
    if (unidad && typeof unidad.km === 'number') {
      setKilometraje(unidad.km);
    }
  }, [unidad]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!unidad) return;
    const km  = parseInt(kilometraje, 10);
    const costo = parseFloat(costoTotal);
    if (isNaN(km) || km < 0)       return;
    if (isNaN(costo) || costo <= 0) return;

    const ok = await onSubmit({
      unidad_id:          unidad.id,
      kilometraje:        km,
      costo_total_mxn:    costo,
      sitio_destino_id:   sitioDestino?.id   || null,
      proyecto_destino_id: proyectoDestino?.id || null,
      descripcion:        descripcion.trim() || null,
    });
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={!isSubmitting ? onClose : undefined}>
      <Box sx={styleModal}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <LocalGasStationIcon color="success" />
          <Typography variant="h6" fontWeight="bold">
            Registrar Carga de Gasolina
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>

            {/* Unidad */}
            <Autocomplete
              options={unidades}
              getOptionLabel={(u) => `${u.no_eco} — ${u.unidad}`}
              value={unidad}
              onChange={(_, v) => setUnidad(v)}
              fullWidth
              renderInput={(params) => (
                <TextField {...params} label="Unidad" required size="small" />
              )}
            />

            {/* Tipo combustible (read-only) */}
            {unidad?.tipo_combustible && (
              <Chip
                label={`Combustible: ${unidad.tipo_combustible}`}
                color="success"
                variant="outlined"
                size="small"
                icon={<LocalGasStationIcon />}
                sx={{ alignSelf: 'flex-start' }}
              />
            )}

            {/* Kilometraje */}
            <TextField
              label="Kilometraje Actual"
              type="number"
              required
              fullWidth
              size="small"
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              inputProps={{ min: 0 }}
              helperText={
                unidad && typeof unidad.km === 'number'
                  ? `Último registrado: ${unidad.km.toLocaleString('es-MX')} km`
                  : 'Selecciona una unidad primero'
              }
            />

            {/* Costo */}
            <TextField
              label="Costo Total MXN"
              type="number"
              required
              fullWidth
              size="small"
              value={costoTotal}
              onChange={(e) => setCostoTotal(e.target.value)}
              inputProps={{ min: 0.01, step: '0.01' }}
            />

            <Divider />

            {/* Sitio destino (opcional) */}
            <Autocomplete
              options={sitios}
              getOptionLabel={(s) => s.nombre || ''}
              value={sitioDestino}
              onChange={(_, v) => { setSitioDestino(v); setProyectoDestino(null); }}
              fullWidth
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sitio Destino (opcional)"
                  size="small"
                  InputProps={{ ...params.InputProps, startAdornment: <MyLocationIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              )}
            />

            {/* Proyecto destino (opcional) */}
            <Autocomplete
              options={
                sitioDestino
                  ? proyectos.filter((p) => p.sitio_id === sitioDestino.id)
                  : proyectos
              }
              getOptionLabel={(p) => p.nombre || ''}
              value={proyectoDestino}
              onChange={(_, v) => setProyectoDestino(v)}
              fullWidth
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Proyecto Destino (opcional)"
                  size="small"
                  InputProps={{ ...params.InputProps, startAdornment: <FolderOpenIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              )}
            />

            {/* Descripción */}
            <TextField
              label="Descripción (opcional)"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas adicionales sobre la carga..."
            />

            {/* Acciones */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
              <Button onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={isSubmitting || !unidad || !kilometraje || !costoTotal}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LocalGasStationIcon />}
              >
                {isSubmitting ? 'Guardando...' : 'Registrar Carga'}
              </Button>
            </Stack>

          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}
