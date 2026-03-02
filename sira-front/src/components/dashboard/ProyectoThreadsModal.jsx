// src/components/dashboard/ProyectoThreadsModal.jsx
/**
 * Modal que muestra todos los threads (comentarios) de los hitos de un proyecto,
 * agrupados por hito. Permite navegar directamente al detalle de comentarios de cada hito.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, Chip, CircularProgress,
  Paper, Divider, IconButton, Tooltip, Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ForumIcon from '@mui/icons-material/Forum';
import FlagIcon from '@mui/icons-material/Flag';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../../api/api';
import HitoComentariosModal from './HitoComentariosModal';

function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/* ── Tarjeta de hito con sus comentarios resumidos ── */
function HitoThreadCard({ hito, onVerTodos }) {
  const [expanded, setExpanded] = useState(false);
  const totalComentarios = hito.comentarios?.reduce(
    (a, c) => a + 1 + (c.respuestas?.length || 0), 0
  ) || 0;
  const resueltos = hito.comentarios?.reduce((a, c) => {
    let n = c.status === 'RESUELTO' ? 1 : 0;
    (c.respuestas || []).forEach((r) => { if (r.status === 'RESUELTO') n++; });
    return a + n;
  }, 0) || 0;

  if (totalComentarios === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: expanded ? 'primary.200' : 'divider',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header del hito */}
      <Box
        onClick={() => setExpanded((p) => !p)}
        sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: expanded ? alpha('#6366f1', 0.04) : 'transparent',
          '&:hover': { bgcolor: alpha('#6366f1', 0.04) },
          transition: 'background 0.2s',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flex={1} minWidth={0}>
          <FlagIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {hito.nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Objetivo: {fmtDate(hito.target_date)}
              {hito.fecha_realizacion && ' • ✓ Realizado'}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
          <Chip
            icon={<ChatBubbleOutlineIcon sx={{ fontSize: '12px !important' }} />}
            label={totalComentarios}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
          {resueltos > 0 && (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
              label={resueltos}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.68rem', height: 22 }}
            />
          )}
          {expanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
        </Stack>
      </Box>

      {/* Comentarios resumidos */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={1}>
            {(hito.comentarios || []).slice(0, 3).map((c) => (
              <Box key={c.id}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Chip
                    label={c.status === 'RESUELTO' ? '✓' : '○'}
                    size="small"
                    color={c.status === 'RESUELTO' ? 'success' : 'warning'}
                    sx={{ fontSize: '0.6rem', height: 18, minWidth: 22 }}
                  />
                  <Box flex={1} minWidth={0}>
                    <Typography variant="caption" fontWeight={600} color="text.primary">
                      {c.usuario_nombre || 'Usuario'}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                      {fmtDateTime(c.creado_en)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: c.status === 'RESUELTO' ? 'line-through' : 'none',
                        textDecorationColor: 'success.light',
                      }}
                    >
                      {c.comentario}
                    </Typography>
                    {(c.respuestas || []).length > 0 && (
                      <Typography variant="caption" color="text.disabled" fontStyle="italic">
                        {c.respuestas.length} respuesta{c.respuestas.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            ))}
            {(hito.comentarios || []).length > 3 && (
              <Typography variant="caption" color="text.disabled" fontStyle="italic">
                … y {hito.comentarios.length - 3} comentario{hito.comentarios.length - 3 !== 1 ? 's' : ''} más
              </Typography>
            )}
          </Stack>

          <Button
            size="small"
            variant="outlined"
            startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
            onClick={() => onVerTodos(hito)}
            sx={{ mt: 1.5, fontSize: '0.72rem', borderRadius: 2 }}
          >
            Ver y responder comentarios
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ── Componente principal ── */
export default function ProyectoThreadsModal({ open, onClose, proyectoId, proyectoNombre }) {
  const [hitosConComentarios, setHitosConComentarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comentariosHito, setComentariosHito] = useState(null);

  const loadData = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Obtener hitos del proyecto
      const hitosData = await api.get(`/api/dashboard/proyectos/${proyectoId}/hitos`);
      const hitos = Array.isArray(hitosData.hitos) ? hitosData.hitos : [];

      // 2. Para cada hito, cargar sus comentarios (en paralelo, solo los que tengan > 0)
      const hitosConData = await Promise.all(
        hitos.map(async (h) => {
          if (!h.total_comentarios || h.total_comentarios === 0) {
            return { ...h, comentarios: [] };
          }
          try {
            const cData = await api.get(`/api/dashboard/hitos/${h.id}/comentarios`);
            return { ...h, comentarios: cData.comentarios || [] };
          } catch {
            return { ...h, comentarios: [] };
          }
        })
      );

      setHitosConComentarios(hitosConData.filter((h) => h.comentarios.length > 0));
    } catch (err) {
      setError(err?.error || err?.message || 'Error al cargar threads.');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (open && proyectoId) loadData();
  }, [open, proyectoId, loadData]);

  const handleComentariosClose = () => {
    setComentariosHito(null);
    loadData();
  };

  const totalThreads = hitosConComentarios.reduce(
    (a, h) => a + h.comentarios.reduce((b, c) => b + 1 + (c.respuestas?.length || 0), 0),
    0
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
      >
        <DialogTitle
          sx={{
            px: 3, py: 2.5,
            background: (t) =>
              `linear-gradient(135deg, ${alpha(t.palette.secondary.main, 0.08)} 0%, transparent 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <ForumIcon fontSize="small" color="secondary" />
                <Typography variant="overline" color="secondary.dark" letterSpacing={1.2} lineHeight={1}>
                  Threads del Proyecto
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {proyectoNombre || 'Proyecto'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Comentarios y discusiones agrupados por hito
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {totalThreads > 0 && (
                <Chip
                  label={`${totalThreads} mensaje${totalThreads !== 1 ? 's' : ''}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
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
          ) : hitosConComentarios.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <ForumIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
              <Typography color="text.secondary" variant="body2" fontWeight={600}>
                Sin comentarios en este proyecto
              </Typography>
              <Typography color="text.disabled" variant="caption">
                Los comentarios aparecerán aquí cuando se agreguen a los hitos del proyecto.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {hitosConComentarios.map((h) => (
                <HitoThreadCard
                  key={h.id}
                  hito={h}
                  onVerTodos={setComentariosHito}
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
