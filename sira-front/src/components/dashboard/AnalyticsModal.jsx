import React, { useEffect, useCallback, useState } from 'react';
import {
  Box, Typography, IconButton, Chip, LinearProgress, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GavelIcon from '@mui/icons-material/Gavel';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useAnalytics } from '../../hooks/useAnalytics';
import { keyframes } from '@mui/system';

/* ── animations ── */
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;
const slideIn = keyframes`
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);   opacity: 1; }
`;
const fadeOut = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(120%); }
`;
const countUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── KPI card definitions ── */
const KPI_DEFS = [
  {
    key: 'rfq_activas',
    label: 'RFQ Activas',
    icon: AssignmentIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    glow: 'rgba(102,126,234,0.4)',
  },
  {
    key: 'oc_por_autorizar',
    label: 'OC Por Autorizar',
    icon: GavelIcon,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    glow: 'rgba(245,87,108,0.4)',
  },
  {
    key: 'oc_por_recolectar',
    label: 'OC Por Recolectar',
    icon: LocalShippingIcon,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glow: 'rgba(79,172,254,0.4)',
  },
  {
    key: 'oc_en_proceso',
    label: 'OC En Proceso',
    icon: InventoryIcon,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    glow: 'rgba(67,233,123,0.4)',
  },
  {
    key: 'dias_promedio_oc',
    label: 'Días Prom. OC',
    icon: TimerIcon,
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    glow: 'rgba(250,112,154,0.4)',
    suffix: ' días',
    nullLabel: '—',
  },
];

/* ── notification icon by type ── */
const NOTIF_META = {
  CREDITO: { icon: AccountBalanceIcon, color: '#4facfe', label: 'Crédito autorizado' },
  SPEI:    { icon: PaymentsIcon,        color: '#43e97b', label: 'SPEI registrado' },
  PAGO:    { icon: CheckCircleIcon,     color: '#fa709a', label: 'Pago registrado' },
};

/* ── toast lifetime ── */
const TOAST_TTL = 3 * 60 * 1000; // 3 min

function KpiCard({ def, value }) {
  const Icon = def.icon;
  const display =
    value == null ? (def.nullLabel ?? '0') : `${value}${def.suffix ?? ''}`;

  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 160,
        borderRadius: 3,
        p: 3,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-2px)' },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: def.gradient,
          opacity: 0.08,
          borderRadius: 'inherit',
        },
      }}
    >
      {/* gradient dot */}
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: def.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 16px ${def.glow}`,
        }}
      >
        <Icon sx={{ color: '#fff', fontSize: 22 }} />
      </Box>

      <Typography
        sx={{
          fontSize: '3rem',
          fontWeight: 800,
          lineHeight: 1,
          background: def.gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${countUp} 0.5s ease`,
        }}
      >
        {display}
      </Typography>

      <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {def.label}
      </Typography>
    </Box>
  );
}

function NotificationToast({ notif, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const meta = NOTIF_META[notif.tipo] || NOTIF_META.PAGO;
  const Icon = meta.icon;

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), TOAST_TTL - 600);
    const removeTimer = setTimeout(() => onDismiss(notif.id), TOAST_TTL);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [notif.id, onDismiss]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 2,
        borderRadius: 2.5,
        background: 'rgba(15,23,42,0.92)',
        border: `1px solid ${meta.color}44`,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${meta.color}22`,
        minWidth: 300,
        maxWidth: 380,
        animation: `${exiting ? fadeOut : slideIn} 0.4s ease forwards`,
      }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: `${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
        <Icon sx={{ color: meta.color, fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, mb: 0.4 }}>
          {notif.titulo}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', lineHeight: 1.4 }}>
          {notif.cuerpo}
        </Typography>
      </Box>
      <IconButton size="small" onClick={() => onDismiss(notif.id)} sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, mt: -0.5, mr: -0.5, '&:hover': { color: '#fff' } }}>
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </Box>
  );
}

function ProjectRow({ proyecto, maxGasto }) {
  const gastoMXN = proyecto.gasto_por_moneda?.find((g) => g.moneda === 'MXN');
  const gastoPrincipal = gastoMXN ?? proyecto.gasto_por_moneda?.[0];
  const pct = maxGasto > 0 && gastoPrincipal ? Math.round((gastoPrincipal.total / maxGasto) * 100) : 0;

  const fmt = (n, mon) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: mon || 'MXN', maximumFractionDigits: 0 }).format(n);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1.2,
        px: 2,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'background 0.2s',
        '&:hover': { background: 'rgba(255,255,255,0.06)' },
      }}
    >
      {/* avatar */}
      <Box
        sx={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
          {proyecto.nombre?.charAt(0).toUpperCase()}
        </Typography>
      </Box>

      {/* name + site */}
      <Box sx={{ flex: 2, minWidth: 0 }}>
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {proyecto.nombre}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem' }}>
          {proyecto.sitio_nombre}
        </Typography>
      </Box>

      {/* bar */}
      <Box sx={{ flex: 3, minWidth: 0 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: 'linear-gradient(90deg,#667eea,#764ba2)',
            },
          }}
        />
      </Box>

      {/* amounts */}
      <Box sx={{ flexShrink: 0, textAlign: 'right', minWidth: 110 }}>
        {proyecto.gasto_por_moneda?.length ? (
          proyecto.gasto_por_moneda.map((g) => (
            <Typography key={g.moneda} sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>
              {fmt(g.total, g.moneda)}
            </Typography>
          ))
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Sin gasto</Typography>
        )}
      </Box>
    </Box>
  );
}

export default function AnalyticsModal({ open, onClose }) {
  const { data, loading, notifs, dismissNotif, refetch } = useAnalytics(open);

  /* keyboard: Esc / Enter / Space close modal */
  const handleKey = useCallback((e) => {
    if (['Escape', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  const proyectos = data?.proyectos ?? [];
  const maxGasto = proyectos.reduce((mx, p) => {
    const principal = p.gasto_por_moneda?.find((g) => g.moneda === 'MXN') ?? p.gasto_por_moneda?.[0];
    return Math.max(mx, principal?.total ?? 0);
  }, 0);

  const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Box
      role="dialog"
      aria-modal="true"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'radial-gradient(ellipse at 20% 50%, #1a1040 0%, #0f172a 60%, #000 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 4,
          py: 2.5,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}
      >
        <TrendingUpIcon sx={{ color: '#667eea', fontSize: 28 }} />
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '1.35rem',
            background: 'linear-gradient(135deg,#667eea,#a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.3px',
          }}
        >
          SIRA · Analytics Compras
        </Typography>

        {/* live indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, ml: 1 }}>
          <FiberManualRecordIcon
            sx={{ color: '#43e97b', fontSize: 10, animation: `${pulse} 2s ease-in-out infinite` }}
          />
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 600 }}>
            EN VIVO
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* clock */}
        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {now}
        </Typography>

        {/* refresh */}
        <Tooltip title="Actualizar ahora">
          <IconButton onClick={refetch} size="small" sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#a78bfa' } }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* close */}
        <Tooltip title="Cerrar (Esc / Enter / Espacio)">
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#f5576c' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* loading bar */}
      {loading && (
        <LinearProgress
          sx={{
            height: 2,
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#667eea,#a78bfa)' },
          }}
        />
      )}

      {/* ── BODY ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, p: 4, overflow: 'auto' }}>

        {/* ── KPI ROW ── */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {KPI_DEFS.map((def) => (
            <KpiCard key={def.key} def={def} value={data?.[def.key] ?? null} />
          ))}
        </Box>

        {/* ── PROJECTS SECTION ── */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* section header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Proyectos en Ejecución
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.07)' }} />
            <Chip
              label={proyectos.length}
              size="small"
              sx={{
                bgcolor: 'rgba(102,126,234,0.15)',
                color: '#a78bfa',
                fontWeight: 700,
                fontSize: '0.72rem',
                height: 20,
              }}
            />
          </Box>

          {/* project list */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, overflowY: 'auto' }}>
            {proyectos.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', py: 2, textAlign: 'center' }}>
                No hay proyectos en ejecución
              </Typography>
            ) : (
              proyectos.map((p) => (
                <ProjectRow key={p.id} proyecto={p} maxGasto={maxGasto} />
              ))
            )}
          </Box>
        </Box>
      </Box>

      {/* ── FLOATING NOTIFICATIONS (bottom-right) ── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: 2100,
          alignItems: 'flex-end',
        }}
      >
        {notifs.map((n) => (
          <NotificationToast key={n.id} notif={n} onDismiss={dismissNotif} />
        ))}
      </Box>
    </Box>
  );
}
