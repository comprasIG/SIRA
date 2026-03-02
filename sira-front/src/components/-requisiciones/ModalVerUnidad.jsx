// sira-front/src/components/-requisiciones/ModalVerUnidad.jsx
import React, { useEffect, useState } from 'react';
import {
  Modal, Box, Typography, Stack, Button, CircularProgress,
  Divider, Grid, Chip, IconButton, Tooltip, TextField,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../../api/api';
import { toast } from 'react-toastify';

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
  maxHeight: '92vh',
  overflowY: 'auto',
};

const COMBUSTIBLE_OPTIONS = ['Diesel', 'Gasolina', 'Electrico', 'Hibrido'];

const normalizarCombustible = (valor) => {
  if (!valor || typeof valor !== 'string') return '';
  const clave = valor
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (clave === 'DIESEL') return 'Diesel';
  if (clave === 'GASOLINA') return 'Gasolina';
  if (clave === 'ELECTRICO') return 'Electrico';
  if (clave === 'HIBRIDO') return 'Hibrido';
  return '';
};

const buildForm = (data) => ({
  tipo_combustible: normalizarCombustible(data?.tipo_combustible),
  tipo_bateria: data?.tipo_bateria || '',
  medidas_llantas: data?.medidas_llantas || '',
  rendimiento_teorico:
    data?.rendimiento_teorico == null ? '' : String(data.rendimiento_teorico),
  km_proximo_servicio:
    data?.km_proximo_servicio == null ? '' : String(data.km_proximo_servicio),
});

const Campo = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body1" fontWeight={500}>{value || '-'}</Typography>
  </Box>
);

const formatKm = (km) =>
  typeof km === 'number' ? `${Number(km).toLocaleString('es-MX')} km` : '-';

export default function ModalVerUnidad({ open, onClose, unidad, onUnidadActualizada }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(buildForm(null));

  useEffect(() => {
    if (open && unidad?.id) {
      setLoading(true);
      setEditando(false);
      api.get(`/api/unidades/${unidad.id}/detalle`)
        .then((data) => {
          setDetalle(data);
          setForm(buildForm(data));
        })
        .catch(() => setDetalle(null))
        .finally(() => setLoading(false));
    } else {
      setDetalle(null);
      setEditando(false);
      setForm(buildForm(null));
    }
  }, [open, unidad]);

  const d = detalle || unidad || {};

  const setCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const iniciarEdicion = () => {
    setForm(buildForm(d));
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setForm(buildForm(d));
    setEditando(false);
  };

  const guardarCambios = async () => {
    if (!COMBUSTIBLE_OPTIONS.includes(form.tipo_combustible)) {
      toast.error('El tipo de combustible debe ser: Diesel, Gasolina, Electrico o Hibrido.');
      return;
    }

    let rendimiento = null;
    if (form.rendimiento_teorico !== '') {
      rendimiento = Number(form.rendimiento_teorico);
      if (!Number.isFinite(rendimiento) || rendimiento < 0) {
        toast.error('Rendimiento teorico invalido.');
        return;
      }
    }

    let kmProximo = null;
    if (form.km_proximo_servicio !== '') {
      kmProximo = Number(form.km_proximo_servicio);
      if (!Number.isInteger(kmProximo) || kmProximo < 0) {
        toast.error('KM proximo servicio invalido.');
        return;
      }
    }

    const payload = {
      tipo_combustible: form.tipo_combustible,
      tipo_bateria: form.tipo_bateria.trim() || null,
      medidas_llantas: form.medidas_llantas.trim() || null,
      rendimiento_teorico: rendimiento,
      km_proximo_servicio: kmProximo,
    };

    setGuardando(true);
    try {
      const actualizado = await api.put(`/api/unidades/${d.id}/detalle`, payload);
      setDetalle(actualizado);
      setForm(buildForm(actualizado));
      setEditando(false);
      toast.success('Informacion de la unidad actualizada.');
      onUnidadActualizada?.(actualizado);
    } catch (error) {
      toast.error(error?.error || 'No se pudo actualizar la unidad.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Informacion de la Unidad</Typography>
          {!loading && d.id && !editando && (
            <Tooltip title="Editar campos tecnicos">
              <span>
                <IconButton size="small" onClick={iniciarEdicion}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>

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
            <Divider sx={{ mb: 2 }}>Identificacion</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}><Campo label="Marca" value={d.marca} /></Grid>
              <Grid item xs={6}><Campo label="Modelo" value={d.modelo} /></Grid>
              <Grid item xs={6}><Campo label="Placas" value={d.placas} /></Grid>
              <Grid item xs={6}><Campo label="No. Economico" value={d.no_eco} /></Grid>
              <Grid item xs={12}><Campo label="VIN / Serie" value={d.serie} /></Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Mecanica y Combustible</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                {editando ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo de Combustible</InputLabel>
                    <Select
                      label="Tipo de Combustible"
                      value={form.tipo_combustible}
                      onChange={(e) => setCampo('tipo_combustible', e.target.value)}
                    >
                      {COMBUSTIBLE_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Campo
                    label="Tipo de Combustible"
                    value={normalizarCombustible(d.tipo_combustible) || d.tipo_combustible}
                  />
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                {editando ? (
                  <TextField
                    label="Tipo de Bateria"
                    size="small"
                    fullWidth
                    value={form.tipo_bateria}
                    onChange={(e) => setCampo('tipo_bateria', e.target.value)}
                  />
                ) : (
                  <Campo label="Tipo de Bateria" value={d.tipo_bateria} />
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                {editando ? (
                  <TextField
                    label="Medidas de Llantas"
                    size="small"
                    fullWidth
                    value={form.medidas_llantas}
                    onChange={(e) => setCampo('medidas_llantas', e.target.value)}
                  />
                ) : (
                  <Campo label="Medidas de Llantas" value={d.medidas_llantas} />
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                {editando ? (
                  <TextField
                    label="Rendimiento Teorico (km/l)"
                    type="number"
                    size="small"
                    fullWidth
                    value={form.rendimiento_teorico}
                    onChange={(e) => setCampo('rendimiento_teorico', e.target.value)}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                ) : (
                  <Campo
                    label="Rendimiento Teorico"
                    value={d.rendimiento_teorico ? `${d.rendimiento_teorico} km/l` : null}
                  />
                )}
              </Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Kilometraje</Divider>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}><Campo label="KM Actual" value={formatKm(d.km)} /></Grid>
              <Grid item xs={12} sm={6}>
                {editando ? (
                  <TextField
                    label="KM Proximo Servicio"
                    type="number"
                    size="small"
                    fullWidth
                    value={form.km_proximo_servicio}
                    onChange={(e) => setCampo('km_proximo_servicio', e.target.value)}
                    inputProps={{ min: 0, step: '1' }}
                  />
                ) : (
                  <Campo label="KM Proximo Servicio" value={formatKm(d.km_proximo_servicio)} />
                )}
              </Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}>Responsable</Divider>
            <Grid container spacing={2}>
              <Grid item xs={6}><Campo label="Responsable" value={d.responsable_nombre} /></Grid>
              <Grid item xs={6}>
                <Campo
                  label="Departamento"
                  value={`${d.departamento_nombre || ''} ${d.departamento_codigo ? `(${d.departamento_codigo})` : ''}`}
                />
              </Grid>
              {d.responsable_correo && (
                <Grid item xs={12}><Campo label="Correo Responsable" value={d.responsable_correo} /></Grid>
              )}
            </Grid>
          </>
        )}

        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ pt: 3 }}>
          {editando && (
            <>
              <Button variant="outlined" onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={guardarCambios}
                disabled={guardando}
                startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </>
          )}
          <Button variant={editando ? 'text' : 'contained'} onClick={onClose} disabled={guardando}>
            Cerrar
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}
