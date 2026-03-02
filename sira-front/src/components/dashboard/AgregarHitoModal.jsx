// src/components/dashboard/AgregarHitoModal.jsx
/**
 * Modal compacto para agregar rápidamente un hito a un proyecto existente.
 * Campos: nombre (req), descripción, fecha objetivo, responsables (multi), thread inicial.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack,
  CircularProgress, InputAdornment, Paper, Collapse, Chip,
  Avatar, IconButton, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import ForumIcon from '@mui/icons-material/Forum';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import api from '../../api/api';

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444'];
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

// Normaliza el nombre desde distintos shapes de usuario
function getNombre(u) {
  return (u.nombre_completo || u.nombre || '').trim() || 'Sin nombre';
}
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function splitSearchTokens(value) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}
function getCorreo(u) {
  return u?.correo_google || u?.correo || u?.email || '';
}
function matchesUserSearch(user, query) {
  const tokens = splitSearchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(
    `${getNombre(user)} ${getCorreo(user)} ${user?.departamento || ''}`
  );
  return tokens.every((token) => haystack.includes(token));
}

const EMPTY = { nombre: '', descripcion: '', target_date: '' };

export default function AgregarHitoModal({ open, onClose, proyectoId, proyectoNombre, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Multi-responsables seleccionados [{ id, nombre }]
  const [selectedResponsables, setSelectedResponsables] = useState([]);

  // Thread inicial opcional
  const [showThread, setShowThread] = useState(false);
  const [threadTexto, setThreadTexto] = useState('');

  // Usuarios para búsqueda de responsable
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setBusqueda('');
      setError(null);
      setSaving(false);
      setShowDropdown(false);
      setShowThread(false);
      setThreadTexto('');
      setSelectedResponsables([]);
    }
  }, [open]);

  // Cargar usuarios una sola vez
  useEffect(() => {
    if (!open || usuarios.length > 0) return;
    setLoadingUsers(true);
    api.get('/api/usuarios')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.usuarios || []);
        setUsuarios(list);
      })
      .catch((err) => {
        console.error('[AgregarHitoModal] Error cargando usuarios:', err);
      })
      .finally(() => setLoadingUsers(false));
  }, [open, usuarios.length]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const usuariosFiltrados = useMemo(() => {
    const alreadyIds = new Set(selectedResponsables.map(r => String(r.id)));
    const base = usuarios.filter(u => !alreadyIds.has(String(u.id)));
    return base.filter((u) => matchesUserSearch(u, busqueda));
  }, [usuarios, busqueda, selectedResponsables]);

  const addResponsable = (u) => {
    const nombre = getNombre(u);
    setSelectedResponsables(prev => {
      if (prev.some(r => String(r.id) === String(u.id))) return prev;
      return [...prev, { id: u.id, nombre }];
    });
    setBusqueda('');
    // Keep dropdown open so user can add more
    searchRef.current?.querySelector('input')?.focus();
  };

  const removeResponsable = (id) => {
    setSelectedResponsables(prev => prev.filter(r => String(r.id) !== String(id)));
  };

  const handleSubmit = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) { setError('El nombre del hito es obligatorio.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        nombre,
        descripcion: form.descripcion.trim() || null,
        target_date: form.target_date || null,
        responsable_ids: selectedResponsables.map(r => Number(r.id)),
      };
      const res = await api.post(`/api/dashboard/proyectos/${proyectoId}/hitos`, payload);

      // Si el usuario escribió un thread inicial, publicarlo
      const threadTrimmed = threadTexto.trim();
      if (threadTrimmed && res.hito?.id) {
        try {
          await api.post(`/api/dashboard/hitos/${res.hito.id}/comentarios`, { comentario: threadTrimmed });
        } catch {
          // El hito ya se creó; ignorar error del thread para no bloquear
        }
      }

      onSuccess?.(res.hito);
      onClose();
    } catch (err) {
      setError(err?.error || 'Error al agregar el hito.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !showDropdown) handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'visible',
        },
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          px: 3, py: 2.5,
          background: (t) =>
            `linear-gradient(135deg, ${alpha('#10b981', 0.12)} 0%, ${alpha('#10b981', 0.03)} 100%)`,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }}>
              <AddCircleIcon fontSize="small" sx={{ color: '#10b981' }} />
              <Typography variant="overline" sx={{ color: '#059669', letterSpacing: 1.3, lineHeight: 1 }}>
                Nuevo Hito
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight={700} color="text.primary" lineHeight={1.2}>
              {proyectoNombre || 'Proyecto'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5, overflow: 'visible' }}>
        <Stack spacing={2}>
          {/* Nombre */}
          <TextField
            label="Nombre del hito *"
            fullWidth
            size="small"
            autoFocus
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            inputProps={{ maxLength: 150 }}
            helperText={`${form.nombre.length}/150`}
            FormHelperTextProps={{ sx: { textAlign: 'right', mr: 0 } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Descripción */}
          <TextField
            label="Descripción"
            fullWidth
            size="small"
            multiline
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Fecha objetivo */}
          <TextField
            label="Fecha objetivo"
            type="date"
            fullWidth
            size="small"
            value={form.target_date}
            onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FlagIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Responsables — multi-buscador */}
          <Box sx={{ position: 'relative' }}>
            {/* Chips de seleccionados */}
            {selectedResponsables.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                {selectedResponsables.map((r) => (
                  <Chip
                    key={r.id}
                    size="small"
                    avatar={
                      <Avatar sx={{ bgcolor: avatarColor(r.nombre), fontSize: '0.6rem', fontWeight: 700 }}>
                        {initials(r.nombre)}
                      </Avatar>
                    }
                    label={r.nombre}
                    onDelete={() => removeResponsable(r.id)}
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      bgcolor: alpha('#6366f1', 0.08),
                      borderColor: alpha('#6366f1', 0.25),
                      border: '1px solid',
                      '& .MuiChip-deleteIcon': { fontSize: 14, color: alpha('#6366f1', 0.5), '&:hover': { color: '#ef4444' } },
                    }}
                  />
                ))}
              </Box>
            )}

            <TextField
              ref={searchRef}
              label={selectedResponsables.length > 0 ? 'Agregar otro responsable' : 'Responsables'}
              fullWidth
              size="small"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar por nombre, correo o departamento…"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonSearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {/* Dropdown de resultados */}
            {showDropdown && (
              <Paper
                ref={dropdownRef}
                elevation={8}
                sx={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 1400,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'primary.100',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {loadingUsers ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : usuariosFiltrados.length === 0 ? (
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {busqueda.trim() ? 'Sin resultados' : 'No hay usuarios disponibles'}
                    </Typography>
                  </Box>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const nombre = getNombre(u);
                    return (
                      <Box
                        key={u.id}
                        onMouseDown={(e) => { e.preventDefault(); addResponsable(u); }}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.25,
                          px: 1.5, py: 1,
                          cursor: 'pointer',
                          bgcolor: 'background.paper',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: alpha('#6366f1', 0.06) },
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 28, height: 28, fontSize: '0.65rem', fontWeight: 700,
                            bgcolor: avatarColor(nombre), flexShrink: 0,
                          }}
                        >
                          {initials(nombre)}
                        </Avatar>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {nombre}
                          </Typography>
                          {u.departamento && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {u.departamento}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Paper>
            )}
          </Box>

          {/* Thread inicial opcional */}
          <Box>
            <Button
              size="small"
              startIcon={<ForumIcon sx={{ fontSize: 15 }} />}
              onClick={() => setShowThread((v) => !v)}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: showThread ? '#8b5cf6' : 'text.secondary',
                textTransform: 'none',
                px: 1.25,
                py: 0.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: showThread ? alpha('#8b5cf6', 0.4) : alpha('#000', 0.12),
                bgcolor: showThread ? alpha('#8b5cf6', 0.06) : 'transparent',
                transition: 'all 0.18s ease',
                '&:hover': {
                  bgcolor: alpha('#8b5cf6', 0.08),
                  borderColor: alpha('#8b5cf6', 0.5),
                  color: '#8b5cf6',
                },
              }}
            >
              {showThread ? 'Quitar thread inicial' : 'Iniciar thread en este hito'}
            </Button>

            <Collapse in={showThread} timeout={220}>
              <TextField
                label="Comentario inicial del thread"
                placeholder="Escribe el primer comentario o pregunta de este hito…"
                fullWidth
                size="small"
                multiline
                rows={3}
                value={threadTexto}
                onChange={(e) => setThreadTexto(e.target.value)}
                sx={{
                  mt: 1.25,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                  },
                  '& label.Mui-focused': { color: '#8b5cf6' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.1 }}>
                      <ForumIcon sx={{ fontSize: 16, color: alpha('#8b5cf6', 0.6) }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Collapse>
          </Box>

          {/* Error */}
          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: -0.5 }}>
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3, py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1,
        }}
      >
        <Button onClick={onClose} variant="outlined" size="small" color="inherit" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={saving || !form.nombre.trim()}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddCircleIcon fontSize="small" />}
          sx={{
            bgcolor: '#10b981',
            '&:hover': { bgcolor: '#059669' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
            borderRadius: 2,
            fontWeight: 600,
            px: 2.5,
            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Guardando…' : 'Agregar Hito'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
