// sira-front/src/components/-requisiciones/ModalVerUnidad.jsx
import React, { useEffect, useState } from 'react';
import {
  Modal, Box, Typography, Stack, Button, CircularProgress,
  Divider, Grid, Chip,
} from '@mui/material';
import api from '../../api/api';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 640,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const Campo = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body1" fontWeight={500}>{value || '—'}</Typography>
  </Box>
);

const formatKm = (km) =>
  typeof km === 'number' ? `${Number(km).toLocaleString('es-MX')} km` : '—';

export default function ModalVerUnidad({ open, onClose, unidad }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && unidad?.id) {
      setLoading(true);
      api.get(`/api/unidades/${unidad.id}/detalle`)
        .then(data => setDetalle(data))
        .catch(() => setDetalle(null))
        .finally(() => setLoading(false));
    } else {
      setDetalle(null);
    }
  }, [open, unidad]);

  const d = detalle || unidad || {};

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6">Información de la Unidad</Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {d.unidad} ({d.no_eco})
        </Typography>
        <Chip
          label={d.activo ? 'Activa' : 'Inactiva'}
          color={d.activo ? 'success' : 'error'}
          size="small"
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Divider sx={{ mb: 2 }}>Identificación</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}><Campo label="Marca" value={d.marca} /></Grid>
              <Grid item xs={6}><Campo label="Modelo" value={d.modelo} /></Grid>
              <Grid item xs={6}><Campo label="Placas" value={d.placas} /></Grid>
              <Grid item xs={6}><Campo label="No. Económico" value={d.no_eco} /></Grid>
              <Grid item xs={12}><Campo label="VIN / Serie" value={d.serie} /></Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Mecánica y Combustible</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}><Campo label="Tipo de Combustible" value={d.tipo_combustible} /></Grid>
              <Grid item xs={6}><Campo label="Tipo de Batería" value={d.tipo_bateria} /></Grid>
              <Grid item xs={6}><Campo label="Medidas de Llantas" value={d.medidas_llantas} /></Grid>
              <Grid item xs={6}><Campo label="Rendimiento Teórico" value={d.rendimiento_teorico ? `${d.rendimiento_teorico} km/l` : null} /></Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Kilometraje</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}><Campo label="KM Actual" value={formatKm(d.km)} /></Grid>
              <Grid item xs={6}><Campo label="KM Próximo Servicio" value={formatKm(d.km_proximo_servicio)} /></Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Responsable</Divider>
            <Grid container spacing={2}>
              <Grid item xs={6}><Campo label="Responsable" value={d.responsable_nombre} /></Grid>
              <Grid item xs={6}><Campo label="Departamento" value={`${d.departamento_nombre || ''} ${d.departamento_codigo ? `(${d.departamento_codigo})` : ''}`} /></Grid>
              {d.responsable_correo && (
                <Grid item xs={12}><Campo label="Correo Responsable" value={d.responsable_correo} /></Grid>
              )}
            </Grid>
          </>
        )}

        <Stack direction="row" justifyContent="flex-end" sx={{ pt: 3 }}>
          <Button variant="contained" onClick={onClose}>Cerrar</Button>
        </Stack>
      </Box>
    </Modal>
  );
}
