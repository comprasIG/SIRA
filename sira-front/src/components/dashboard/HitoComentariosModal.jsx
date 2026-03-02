// src/components/dashboard/HitoComentariosModal.jsx
/**
 * Modal de comentarios (threads) para un hito específico.
 * Permite ver, agregar y responder comentarios, así como cambiar su status.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, Chip, IconButton,
  TextField, CircularProgress, Divider, Tooltip,
  Avatar, Paper, Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ReplyIcon from '@mui/icons-material/Reply';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FlagIcon from '@mui/icons-material/Flag';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../../api/api';
import { AuthContext } from '../../context/authContext';

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getInitials(nombre) {
  if (!nombre) return '?';
  const parts = nombre.trim().split(' ');
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : nombre[0].toUpperCase();
}

/* ── Colores de avatar deterministicos ── */
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#0ea5e9', '#ef4444', '#84cc16',
];
function avatarColor(nombre) {
  if (!nombre) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ── Componente de un comentario individual ── */
function ComentarioItem({ comentario, onReply, onStatusChange, depth = 0 }) {
  const isResuelto = comentario.status === 'RESUELTO';
  const color = avatarColor(comentario.usuario_nombre);
  const numRespuestas = (comentario.respuestas || []).length;

  // Respuestas expandidas por defecto
  const [expanded, setExpanded] = useState(true);

  return (
    <Box sx={{ ml: depth > 0 ? 4 : 0 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderRadius: 2,
          borderColor: depth > 0 ? 'primary.100' : 'divider',
          bgcolor: depth > 0
            ? alpha('#6366f1', 0.03)
            : isResuelto ? alpha('#10b981', 0.04) : 'background.paper',
          opacity: isResuelto ? 0.8 : 1,
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        {depth > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: -16,
              top: 16,
              width: 12,
              height: 12,
              borderLeft: '2px solid',
              borderBottom: '2px solid',
              borderColor: 'primary.200',
              borderBottomLeftRadius: 4,
            }}
          />
        )}

        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              width: 30, height: 30, fontSize: '0.7rem', fontWeight: 700,
              bgcolor: color, flexShrink: 0,
            }}
          >
            {getInitials(comentario.usuario_nombre)}
          </Avatar>

          <Box flex={1} minWidth={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.primary">
                  {comentario.usuario_nombre || 'Usuario'}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                  {fmtDateTime(comentario.creado_en)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Chip
                  label={isResuelto ? 'Resuelto' : 'Pendiente'}
                  size="small"
                  color={isResuelto ? 'success' : 'warning'}
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              </Stack>
            </Stack>

            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                color: 'text.primary',
                lineHeight: 1.5,
                wordBreak: 'break-word',
                textDecoration: isResuelto ? 'line-through' : 'none',
                textDecorationColor: 'success.light',
              }}
            >
              {comentario.comentario}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              {depth === 0 && (
                <Tooltip title="Responder">
                  <Button
                    size="small"
                    startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onReply(comentario)}
                    sx={{ fontSize: '0.7rem', py: 0, minHeight: 24, color: 'text.secondary' }}
                  >
                    Responder
                  </Button>
                </Tooltip>
              )}
              {depth === 0 && numRespuestas > 0 && (
                <Tooltip title={expanded ? 'Colapsar respuestas' : 'Ver respuestas'}>
                  <Button
                    size="small"
                    startIcon={expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setExpanded((v) => !v)}
                    sx={{
                      fontSize: '0.7rem', py: 0, minHeight: 24,
                      color: expanded ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {expanded ? 'Ocultar' : `${numRespuestas} respuesta${numRespuestas !== 1 ? 's' : ''}`}
                  </Button>
                </Tooltip>
              )}
              <Tooltip title={isResuelto ? 'Marcar como pendiente' : 'Marcar como resuelto'}>
                <IconButton
                  size="small"
                  onClick={() => onStatusChange(comentario.id, isResuelto ? 'PENDIENTE' : 'RESUELTO')}
                  color={isResuelto ? 'success' : 'default'}
                  sx={{ p: 0.25 }}
                >
                  {isResuelto
                    ? <CheckCircleIcon sx={{ fontSize: 18 }} />
                    : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Respuestas anidadas — colapsables */}
      {numRespuestas > 0 && (
        <Collapse in={expanded} timeout={220}>
          <Stack spacing={1} sx={{ mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'primary.100' }}>
            {comentario.respuestas.map((r) => (
              <ComentarioItem
                key={r.id}
                comentario={r}
                onReply={onReply}
                onStatusChange={onStatusChange}
                depth={depth + 1}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}

/* ── Formulario de nuevo comentario / respuesta ── */
function CommentForm({ parentComentario, onSubmit, onCancel, loading }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <Box sx={{ mt: 1 }}>
      {parentComentario && (
        <Paper
          variant="outlined"
          sx={{ p: 1, mb: 1, borderRadius: 1.5, bgcolor: alpha('#6366f1', 0.04), borderColor: 'primary.200' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="primary" fontWeight={600}>
              Respondiendo a {parentComentario.usuario_nombre || 'usuario'}
            </Typography>
            {onCancel && (
              <IconButton size="small" onClick={onCancel} sx={{ p: 0.25 }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3, fontStyle: 'italic' }}>
            "{(parentComentario.comentario || '').slice(0, 80)}{parentComentario.comentario?.length > 80 ? '…' : ''}"
          </Typography>
        </Paper>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder={parentComentario ? 'Escribe tu respuesta… (Ctrl+Enter para enviar)' : 'Escribe un comentario… (Ctrl+Enter para enviar)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
          }}
        />
        <Tooltip title={parentComentario ? 'Enviar respuesta' : 'Agregar comentario'}>
          <span>
            <IconButton
              color="primary"
              onClick={handleSubmit}
              disabled={!text.trim() || loading}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                borderRadius: 2,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              }}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

/* ── Componente principal ── */
export default function HitoComentariosModal({ open, onClose, hitoId, hitoNombre }) {
  const { usuario } = useContext(AuthContext) || {};
  const [comentarios, setComentarios] = useState([]);
  const [hitoInfo, setHitoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null); // comentario al que se responde

  const loadComentarios = useCallback(async () => {
    if (!hitoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/dashboard/hitos/${hitoId}/comentarios`);
      setComentarios(Array.isArray(data.comentarios) ? data.comentarios : []);
      if (data.hito) setHitoInfo(data.hito);
    } catch (err) {
      setError(err?.error || err?.message || 'Error al cargar comentarios.');
    } finally {
      setLoading(false);
    }
  }, [hitoId]);

  useEffect(() => {
    if (open && hitoId) {
      loadComentarios();
      setReplyTarget(null);
    }
  }, [open, hitoId, loadComentarios]);

  const handleAddComentario = async (text) => {
    setSubmitting(true);
    try {
      await api.post(`/api/dashboard/hitos/${hitoId}/comentarios`, { comentario: text });
      setReplyTarget(null);
      await loadComentarios();
    } catch (err) {
      setError(err?.error || 'Error al agregar comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (text) => {
    if (!replyTarget) return;
    setSubmitting(true);
    try {
      await api.post(`/api/dashboard/hitos/comentarios/${replyTarget.id}/responder`, { comentario: text });
      setReplyTarget(null);
      await loadComentarios();
    } catch (err) {
      setError(err?.error || 'Error al responder.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (comentarioId, newStatus) => {
    try {
      await api.patch(`/api/dashboard/hitos/comentarios/${comentarioId}/status`, { status: newStatus });
      await loadComentarios();
    } catch (err) {
      setError(err?.error || 'Error al cambiar estado.');
    }
  };

  const totalComentarios = comentarios.reduce(
    (acc, c) => acc + 1 + (c.respuestas?.length || 0), 0
  );
  const resueltos = comentarios.reduce((acc, c) => {
    let count = c.status === 'RESUELTO' ? 1 : 0;
    (c.respuestas || []).forEach((r) => { if (r.status === 'RESUELTO') count++; });
    return acc + count;
  }, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, maxHeight: '90vh' },
      }}
    >
      <DialogTitle
        sx={{
          px: 3, py: 2.5,
          background: (t) =>
            `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(t.palette.primary.main, 0.03)} 100%)`,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <ChatBubbleOutlineIcon fontSize="small" color="primary" />
              <Typography variant="overline" color="primary" letterSpacing={1.2} lineHeight={1}>
                Comentarios del Hito
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {hitoNombre || hitoInfo?.nombre || 'Hito'}
            </Typography>
            {hitoInfo?.proyecto_nombre && (
              <Typography variant="caption" color="text.secondary">
                Proyecto: {hitoInfo.proyecto_nombre}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {totalComentarios > 0 && (
              <>
                <Chip
                  label={`${totalComentarios} comentario${totalComentarios !== 1 ? 's' : ''}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
                {resueltos > 0 && (
                  <Chip
                    label={`${resueltos} resuelto${resueltos !== 1 ? 's' : ''}`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
              </>
            )}
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={36} />
          </Box>
        ) : comentarios.length === 0 ? (
          <Box
            sx={{
              py: 6, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
            }}
          >
            <FlagIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary" variant="body2">
              No hay comentarios aún. ¡Sé el primero en comentar!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {comentarios.map((c) => (
              <ComentarioItem
                key={c.id}
                comentario={c}
                onReply={setReplyTarget}
                onStatusChange={handleStatusChange}
                depth={0}
              />
            ))}
          </Stack>
        )}

        <Divider sx={{ mt: 1 }} />

        {/* Formulario de nuevo comentario o respuesta */}
        <Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {replyTarget ? 'RESPONDER' : 'NUEVO COMENTARIO'}
          </Typography>
          <CommentForm
            parentComentario={replyTarget}
            onSubmit={replyTarget ? handleReply : handleAddComentario}
            onCancel={replyTarget ? () => setReplyTarget(null) : null}
            loading={submitting}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" size="small">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
