// src/components/dashboard/HitosTab.jsx
/**
 * Tab "TO DO" — KPI de Hitos con responsables asignados (múltiples).
 * Permite marcar hitos como realizados/pendientes y ver/gestionar comentarios.
 */

import React, { useState } from 'react';
import {
  Box, Paper, CircularProgress, Typography, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, IconButton, Stack, ToggleButton, ToggleButtonGroup,
  TextField, InputAdornment, MenuItem, Select, FormControl,
  Avatar, AvatarGroup,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useHitosDashboard } from '../../hooks/useHitosDashboard';
import HitoComentariosModal from './HitoComentariosModal';

const paperSx = {
  p: 2,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  transition: 'box-shadow 0.3s ease',
  '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)' },
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

/* ── KPI chips ── */
function KpiCard({ label, value, color }) {
  return (
    <Box
      sx={{
        flex: '1 1 120px',
        minWidth: 110,
        p: 1.5,
        borderRadius: 2,
        bgcolor: `${color}.50`,
        border: '1px solid',
        borderColor: `${color}.100`,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" fontWeight={800} color={`${color}.main`} lineHeight={1}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
        {label}
      </Typography>
    </Box>
  );
}

/* ── Estado badge ── */
function EstadoBadge({ estado }) {
  const map = {
    PENDIENTE: { color: 'warning', label: 'Pendiente' },
    VENCIDO:   { color: 'error',   label: 'Vencido'   },
    REALIZADO: { color: 'success', label: 'Realizado' },
  };
  const cfg = map[estado] || map.PENDIENTE;
  return <Chip label={cfg.label} color={cfg.color} size="small" variant="outlined" />;
}

/* ── Responsables (múltiples avatares) ── */
function ResponsablesCell({ responsables }) {
  if (!responsables || responsables.length === 0) {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }
  if (responsables.length === 1) {
    const r = responsables[0];
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Tooltip title={r.nombre}>
          <Avatar
            sx={{
              width: 26, height: 26, fontSize: '0.62rem', fontWeight: 700,
              bgcolor: avatarColor(r.nombre),
            }}
          >
            {initials(r.nombre)}
          </Avatar>
        </Tooltip>
        <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
          {r.nombre}
        </Typography>
      </Box>
    );
  }
  return (
    <AvatarGroup
      max={3}
      sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.62rem', fontWeight: 700 } }}
    >
      {responsables.map((r) => (
        <Tooltip key={r.id} title={r.nombre}>
          <Avatar sx={{ bgcolor: avatarColor(r.nombre) }}>
            {initials(r.nombre)}
          </Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

/* ── Filtros ── */
function HitosFilters({ filters, estadoOptions, departamentoOptions, proyectoOptions, responsableOptions, onChange, onReset }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
      {/* Búsqueda libre */}
      <TextField
        size="small"
        placeholder="Buscar hito, proyecto, responsable…"
        value={filters.search}
        onChange={(e) => onChange('search', e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
        sx={{ minWidth: 240, flex: '1 1 240px' }}
      />

      {/* Estado */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <Select
          value={filters.estado}
          onChange={(e) => onChange('estado', e.target.value)}
          displayEmpty
        >
          <MenuItem value="">Todos los estados</MenuItem>
          {estadoOptions.filter(Boolean).map((e) => (
            <MenuItem key={e} value={e}>{e.charAt(0) + e.slice(1).toLowerCase()}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Departamento */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select
          value={filters.departamento}
          onChange={(e) => onChange('departamento', e.target.value)}
          displayEmpty
        >
          <MenuItem value="">Mi departamento</MenuItem>
          {departamentoOptions.filter(Boolean).map((d) => (
            <MenuItem key={d} value={d}>{d}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Proyecto */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select
          value={filters.proyecto}
          onChange={(e) => onChange('proyecto', e.target.value)}
          displayEmpty
        >
          <MenuItem value="">Todos los proyectos</MenuItem>
          {proyectoOptions.filter(Boolean).map((p) => (
            <MenuItem key={p} value={p}>{p}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Responsable */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select
          value={filters.responsable}
          onChange={(e) => onChange('responsable', e.target.value)}
          displayEmpty
        >
          <MenuItem value="">Todos los responsables</MenuItem>
          {responsableOptions.filter(Boolean).map((r) => (
            <MenuItem key={r} value={r}>{r}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Toggle: mostrar todos los departamentos */}
      <ToggleButtonGroup
        size="small"
        value={filters.showAll ? 'all' : 'mine'}
        exclusive
        onChange={(_, val) => { if (val !== null) onChange('showAll', val === 'all'); }}
      >
        <ToggleButton value="mine">Mi depto</ToggleButton>
        <ToggleButton value="all">Todos</ToggleButton>
      </ToggleButtonGroup>

      {/* Toggle: incluir realizados */}
      <ToggleButtonGroup
        size="small"
        value={filters.includeDone ? 'all' : 'pending'}
        exclusive
        onChange={(_, val) => { if (val !== null) onChange('includeDone', val === 'all'); }}
      >
        <ToggleButton value="pending">Pendientes</ToggleButton>
        <ToggleButton value="all">Todos</ToggleButton>
      </ToggleButtonGroup>

      {/* Limpiar */}
      <Box
        component="button"
        type="button"
        onClick={onReset}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: 'background.paper',
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: 'text.secondary',
          '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
        }}
      >
        Limpiar
      </Box>
    </Stack>
  );
}

/* ── Tabla principal ── */
function HitosTable({ hitos, onMarcarRealizado, onMarcarPendiente, onVerComentarios }) {
  const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, dia] = d.split('-');
    return `${dia}/${m}/${y}`;
  };

  if (hitos.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hitos que coincidan con los filtros actuales.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 700 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', bgcolor: 'grey.50' } }}>
            <TableCell>Hito</TableCell>
            <TableCell>Proyecto</TableCell>
            <TableCell>Responsables</TableCell>
            <TableCell align="center">Objetivo</TableCell>
            <TableCell align="center">Estado</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {hitos.map((h) => (
            <TableRow
              key={h.id}
              sx={{
                '&:hover': { bgcolor: 'action.hover' },
                opacity: h.estado === 'REALIZADO' ? 0.65 : 1,
              }}
            >
              {/* Hito */}
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                  {h.nombre}
                </Typography>
                {h.descripcion && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                    {h.descripcion.length > 60 ? `${h.descripcion.slice(0, 60)}…` : h.descripcion}
                  </Typography>
                )}
              </TableCell>

              {/* Proyecto */}
              <TableCell sx={{ maxWidth: 180 }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {h.proyecto_nombre}
                </Typography>
              </TableCell>

              {/* Responsables (múltiples) */}
              <TableCell>
                <ResponsablesCell responsables={h.responsables} />
              </TableCell>

              {/* Objetivo */}
              <TableCell align="center">
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.78rem',
                    color: h.estado === 'VENCIDO' ? 'error.main' : 'text.secondary',
                    fontWeight: h.estado === 'VENCIDO' ? 600 : 400,
                  }}
                >
                  {fmtDate(h.target_date)}
                </Typography>
              </TableCell>

              {/* Estado */}
              <TableCell align="center">
                <EstadoBadge estado={h.estado} />
                {h.estado === 'REALIZADO' && h.fecha_realizacion && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                    {fmtDate(h.fecha_realizacion)}
                  </Typography>
                )}
              </TableCell>

              {/* Acciones */}
              <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                  {/* Comentarios */}
                  <Tooltip title="Ver comentarios">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onVerComentarios(h)}
                      sx={{
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                        bgcolor: alpha('#6366f1', 0.06),
                        '&:hover': { bgcolor: alpha('#6366f1', 0.12) },
                      }}
                    >
                      <ChatBubbleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {/* Marcar realizado / revertir */}
                  {h.estado !== 'REALIZADO' ? (
                    <Tooltip title="Marcar como realizado">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onMarcarRealizado(h.id)}
                      >
                        <CheckCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Revertir a pendiente">
                      <IconButton
                        size="small"
                        color="default"
                        onClick={() => onMarcarPendiente(h.id)}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/* ── Componente principal ── */
export default function HitosTab() {
  const [comentariosHito, setComentariosHito] = useState(null);

  const {
    loading,
    error,
    hitos,
    kpis,
    filters,
    estadoOptions,
    departamentoOptions,
    proyectoOptions,
    responsableOptions,
    setFilter,
    resetFilters,
    marcarRealizado,
    marcarPendiente,
    reload,
  } = useHitosDashboard();

  const handleComentariosClose = () => {
    setComentariosHito(null);
    reload(); // refrescar por si cambió algo
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* KPIs */}
        <Paper sx={paperSx}>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            <KpiCard label="Total" value={kpis.total} color="primary" />
            <KpiCard label="Pendientes" value={kpis.pendientes} color="warning" />
            <KpiCard label="Vencidos" value={kpis.vencidos} color="error" />
            <KpiCard label="Realizados" value={kpis.realizados} color="success" />
          </Stack>
        </Paper>

        {/* Filtros */}
        <Paper sx={paperSx}>
          <HitosFilters
            filters={filters}
            estadoOptions={estadoOptions}
            departamentoOptions={departamentoOptions}
            proyectoOptions={proyectoOptions}
            responsableOptions={responsableOptions}
            onChange={setFilter}
            onReset={resetFilters}
          />
        </Paper>

        {/* Tabla */}
        <Paper sx={paperSx}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={36} />
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <HitosTable
              hitos={hitos}
              onMarcarRealizado={marcarRealizado}
              onMarcarPendiente={marcarPendiente}
              onVerComentarios={setComentariosHito}
            />
          )}
        </Paper>
      </Box>

      {/* Modal de comentarios */}
      <HitoComentariosModal
        open={!!comentariosHito}
        onClose={handleComentariosClose}
        hitoId={comentariosHito?.id}
        hitoNombre={comentariosHito?.nombre}
      />
    </>
  );
}
