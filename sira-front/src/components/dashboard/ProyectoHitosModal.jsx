// src/components/dashboard/ProyectoHitosModal.jsx
/**
 * Modal que muestra los hitos de un proyecto específico,
 * con soporte para ver/abrir sus comentarios.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, Chip, CircularProgress,
  Paper, Tooltip, IconButton, Avatar, AvatarGroup,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import api from '../../api/api';
import HitoComentariosModal from './HitoComentariosModal';

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
}

const ESTADO_CFG = {
  REALIZADO: { color: 'success', label: 'Realizado', Icon: CheckCircleOutlineIcon },
  VENCIDO:   { color: 'error',   label: 'Vencido',   Icon: ErrorOutlineIcon },
  PENDIENTE: { color: 'warning', label: 'Pendiente', Icon: RadioButtonUncheckedIcon },
};

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9'];
function avatarColor(nombre) {
  if (!nombre) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(' ');
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : nombre[0].toUpperCase();
}

function HitoCard({ hito, onVerComentarios }) {
  const cfg = ESTADO_NOMBRE[hito.estado] || ESTADO_CFG.PENDIENTE;
  const { Icon } = cfg;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, borderRadius: 2,
        borderColor: hito.estado === 'VENCIDO'
          ? alpha('#ef4444', 0.3)
          : hito.estado === 'REALIZADO'
          ? alpha('#10b981', 0.2)
          : 'divider',
        bgcolor: hito.estado === 'REALIZADO' ? alpha('#10b981', 0.03) : 'background.paper',
        opacity: hito.estado === 'REALIZADO' ? 0.85 : 1,
        transition: 'all 0.2s',
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Icon
          sx={{
            color: `${cfg.color}.main`,
            mt: 0.3,
            fontSize: 20,
            flexShrink: 0,
          }}
        />

        <Box flex={1} minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  textDecoration: hito.estado === 'REALIZADO' ? 'line-through' : 'none',
                  textDecorationColor: 'success.light',
                  lineHeight: 1.3,
                }}
              >
                {hito.nombre}
              </Typography>
              {hito.descripcion && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                  {hito.descripcion}
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
              <Chip
                label={cfg.label}
                size="small"
                color={cfg.color}
                variant="outlined"
                sx={{ fontSize: '0.68rem', height: 22 }}
              />
            </Stack>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Fecha objetivo */}
              <Box>
                <Typography variant="caption" color="text.disabled" display="block">Objetivo</Typography>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color={hito.estado === 'VENCIDO' ? 'error.main' : 'text.secondary'}
                >
                  {fmtDate(hito.target_date)}
                </Typography>
              </Box>

              {/* Fecha realización */}
              {hito.fecha_realizacion && (
                <Box>
                  <Typography variant="caption" color="text.disabled" display="block">Realizado</Typography>
                  <Typography variant="caption" fontWeight={600} color="success.main">
                    {fmtDate(hito.fecha_realizacion)}
                  </Typography>
                </Box>
              )}

              {/* Responsables */}
              {(hito.responsables || []).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.disabled" display="block">Responsables</Typography>
                  <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.6rem' } }}>
                    {hito.responsables.map((r) => (
                      <Tooltip key={r.id} title={r.nombre}>
                        <Avatar sx={{ bgcolor: avatarColor(r.nombre), width: 22, height: 22, fontSize: '0.6rem' }}>
                          {initials(r.nombre)}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                </Box>
              )}
            </Stack>

            {/* Comentarios */}
            <Tooltip title={`Ver comentarios (${hito.total_comentarios || 0})`}>
              <Button
                size="small"
                startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
                onClick={() => onVerComentarios(hito)}
                sx={{
                  fontSize: '0.72rem', py: 0.25, px: 1, minHeight: 26,
                  color: hito.total_comentarios > 0 ? 'primary.main' : 'text.disabled',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: hito.total_comentarios > 0 ? 'primary.200' : 'divider',
                  bgcolor: hito.total_comentarios > 0 ? alpha('#6366f1', 0.05) : 'transparent',
                }}
              >
                {hito.total_comentarios || 0}
              </Button>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

// Fix: usar ESTADO_CFG
const ESTADO_NOMBRE = ESTADO_CFG;

export default function ProyectoHitosModal({ open, onClose, proyectoId, proyectoNombre }) {
  const [hitos, setHitos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comentariosHito, setComentariosHito] = useState(null); // hito seleccionado para ver comentarios

  const loadHitos = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/dashboard/proyectos/${proyectoId}/hitos`);
      setHitos(Array.isArray(data.hitos) ? data.hitos : []);
    } catch (err) {
      setError(err?.error || err?.message || 'Error al cargar hitos.');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (open && proyectoId) loadHitos();
  }, [open, proyectoId, loadHitos]);

  // Recarga hitos cuando se cierra el modal de comentarios (para actualizar conteo)
  const handleComentariosClose = () => {
    setComentariosHito(null);
    loadHitos();
  };

  const kpis = {
    total: hitos.length,
    pendientes: hitos.filter((h) => h.estado === 'PENDIENTE').length,
    vencidos: hitos.filter((h) => h.estado === 'VENCIDO').length,
    realizados: hitos.filter((h) => h.estado === 'REALIZADO').length,
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '88vh' } }}
      >
        <DialogTitle
          sx={{
            px: 3, py: 2.5,
            background: (t) => `linear-gradient(135deg, ${alpha(t.palette.warning.main, 0.1)} 0%, transparent 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <FlagIcon fontSize="small" sx={{ color: 'warning.main' }} />
                <Typography variant="overline" color="warning.dark" letterSpacing={1.2} lineHeight={1}>
                  Hitos del Proyecto
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {proyectoNombre || 'Proyecto'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {hitos.length > 0 && (
                <>
                  <Chip label={`${kpis.total} total`} size="small" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                  {kpis.pendientes > 0 && (
                    <Chip label={`${kpis.pendientes} pendiente${kpis.pendientes !== 1 ? 's' : ''}`} size="small" color="warning" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                  )}
                  {kpis.vencidos > 0 && (
                    <Chip label={`${kpis.vencidos} vencido${kpis.vencidos !== 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                  )}
                  {kpis.realizados > 0 && (
                    <Chip label={`${kpis.realizados} realizado${kpis.realizados !== 1 ? 's' : ''}`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                  )}
                </>
              )}
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2.5, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ py: 2 }}>{error}</Typography>
          ) : hitos.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <FlagIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary" variant="body2">
                Este proyecto no tiene hitos registrados.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {hitos.map((h) => (
                <HitoCard
                  key={h.id}
                  hito={h}
                  onVerComentarios={setComentariosHito}
                />
              ))}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={onClose} variant="outlined" size="small">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de comentarios del hito seleccionado */}
      <HitoComentariosModal
        open={!!comentariosHito}
        onClose={handleComentariosClose}
        hitoId={comentariosHito?.id}
        hitoNombre={comentariosHito?.nombre}
      />
    </>
  );
}
