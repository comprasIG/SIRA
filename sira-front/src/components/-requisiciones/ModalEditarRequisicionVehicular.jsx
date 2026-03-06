// sira-front/src/components/-requisiciones/ModalEditarRequisicionVehicular.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Typography, Divider,
  CircularProgress, Alert, Box, Chip,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BuildIcon from '@mui/icons-material/Build';
import InventoryIcon from '@mui/icons-material/Inventory';
import api from '../../api/api';
import { toast } from 'react-toastify';

export default function ModalEditarRequisicionVehicular({ open, requisicionId, onClose, onGuardado }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fechaRequerida, setFechaRequerida] = useState('');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (!open || !requisicionId) return;

    setLoading(true);
    api.get(`/api/unidades/requisicion/${requisicionId}/detalle-vehicular`)
      .then((data) => {
        setDetalle(data);
        setFechaRequerida(data.fecha_requerida ? data.fecha_requerida.split('T')[0] : '');
        setComentario(data.comentario || '');
      })
      .catch(() => {
        toast.error('No se pudo cargar el detalle de la requisición.');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, requisicionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuardar = async () => {
    if (!fechaRequerida) {
      toast.error('La fecha requerida es obligatoria.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/api/unidades/requisicion/${requisicionId}`, {
        fecha_requerida: fechaRequerida,
        comentario,
      });
      toast.success('Requisición actualizada correctamente.');
      onGuardado?.();
      onClose();
    } catch (err) {
      toast.error(err?.error || 'No se pudo actualizar la requisición.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Editar Requisición Vehicular
        {detalle && (
          <Chip
            label={detalle.numero_requisicion}
            color="primary"
            size="small"
            variant="outlined"
            sx={{ ml: 1.5, verticalAlign: 'middle' }}
          />
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : detalle ? (
          <Stack spacing={2.5}>
            {/* Información de solo lectura */}
            <Alert severity="info" variant="outlined" icon={false} sx={{ py: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Esta requisición fue generada automáticamente desde Flotilla Vehicular.
                Solo puedes modificar la fecha y el comentario.
              </Typography>
            </Alert>

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DirectionsCarIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Unidad:</strong> {detalle.unidad_nombre} ({detalle.no_eco})
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <BuildIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Servicio:</strong> {detalle.servicio_nombre}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <InventoryIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Material:</strong> {detalle.material_nombre}{' '}
                  <Typography component="span" variant="caption" fontFamily="monospace" color="text.secondary">
                    ({detalle.material_sku})
                  </Typography>
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Solicitante: {detalle.creador_nombre}
              </Typography>
            </Stack>

            <Divider />

            {/* Campos editables */}
            <TextField
              label="Fecha Requerida"
              type="date"
              required
              fullWidth
              value={fechaRequerida}
              onChange={(e) => setFechaRequerida(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={isSubmitting}
            />

            <TextField
              label="Descripción / Comentarios"
              multiline
              rows={3}
              fullWidth
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Detalles adicionales del servicio..."
              disabled={isSubmitting}
            />
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleGuardar}
          disabled={loading || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
