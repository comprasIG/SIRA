import React, { useMemo, useState } from 'react';
import { Typography, Box, Paper, CircularProgress, Tabs, Tab, IconButton, Tooltip } from '@mui/material';
import { keyframes } from '@mui/system';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BadgeIcon from '@mui/icons-material/Badge';
import BarChartIcon from '@mui/icons-material/BarChart';
import KpiRow from './KpiRow';
import DashboardFilters from './DashboardFilters';
import RfqTable from './RfqTable';
import dashboardConfig from './dashboardConfig';
import { useDashboard } from '../../hooks/useDashboard';
import ProyectosTab from './ProyectosTab';
import PermisosRHTab from './PermisosRHTab';
import HitosTab from './HitosTab';
import AnalyticsModal from './AnalyticsModal';

/* ── Instagram-style gradient spin animation ── */
const gradientSpin = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/* ── Subtle float animation for the active tab icon ── */
const floatUp = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
`;

/* ── Shared tab styling with animated gradient border on hover ── */
const tabSx = {
  position: 'relative',
  fontWeight: 600,
  fontSize: '0.85rem',
  letterSpacing: '0.3px',
  textTransform: 'none',
  color: 'text.secondary',
  px: 3,
  py: 1.5,
  minHeight: 52,
  borderRadius: '12px 12px 0 0',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'visible',
  zIndex: 1,

  /* Animated gradient underline pseudo-element */
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%) scaleX(0)',
    width: '80%',
    height: '3px',
    borderRadius: '3px 3px 0 0',
    background: 'linear-gradient(90deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888, #833ab4, #5851db, #405de6)',
    backgroundSize: '200% 200%',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  '&:hover': {
    color: 'text.primary',
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
    '&::after': {
      transform: 'translateX(-50%) scaleX(1)',
      animation: `${gradientSpin} 2s ease infinite`,
    },
  },

  '&.Mui-selected': {
    color: 'primary.main',
    fontWeight: 700,
    '&::after': {
      transform: 'translateX(-50%) scaleX(1)',
      animation: `${gradientSpin} 2s ease infinite`,
    },
    '& .MuiSvgIcon-root': {
      animation: `${floatUp} 2s ease-in-out infinite`,
    },
  },

  '& .MuiSvgIcon-root': {
    fontSize: '1.2rem',
    transition: 'transform 0.3s ease',
  },
};

/* ── Polished Paper wrapper ── */
const paperSx = {
  p: 2,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  transition: 'box-shadow 0.3s ease, transform 0.2s ease',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)',
  },
};

export default function DashboardBase({ mode }) {
  const config = useMemo(() => dashboardConfig[mode] || {}, [mode]);
  const [activeTab, setActiveTab] = useState(0);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const showProyectos = config.showProyectosTab !== false;
  const showHitos = config.showHitosTab !== false && showProyectos;
  const isSSD = mode === 'SSD';

  // Tab index mapping when hitos tab is visible:
  //   0 = TO DO, 1 = Requisiciones, 2 = Proyectos, 3 = Permisos RH
  // When hitos tab is hidden (showHitos=false, showProyectos=true):
  //   0 = Requisiciones, 1 = Proyectos, 2 = Permisos RH
  // When showProyectos=false: no tabs, only Requisiciones
  const tabRequisiciones = showHitos ? 1 : 0;
  const tabProyectos     = showHitos ? 2 : 1;
  const tabPermisos      = showHitos ? 3 : 2;

  const {
    loading,
    error,
    kpis,
    rfqs,
    filters,
    options,
    setFilter,
    resetFilters,
    reload,
  } = useDashboard(mode);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.3px',
            flex: 1,
          }}
        >
          {config.title || 'Dashboard'}
        </Typography>

        {isSSD && (
          <Tooltip title="Ver analytics en pantalla completa (TV)">
            <IconButton
              onClick={() => setAnalyticsOpen(true)}
              size="small"
              sx={{
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 0.75,
                '&:hover': {
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(102,126,234,0.06)',
                },
              }}
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {isSSD && (
        <AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
      )}

      {/* ── Tabs (solo si Proyectos habilitado) ── */}
      {showProyectos && (
        <Paper
          sx={{
            px: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'visible',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            TabIndicatorProps={{ style: { display: 'none' } }}
            sx={{
              minHeight: 52,
              '& .MuiTabs-flexContainer': { gap: 0.5 },
            }}
          >
            {showHitos && (
              <Tab
                icon={<AssignmentIcon />}
                iconPosition="start"
                label="TO DO"
                sx={tabSx}
              />
            )}
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Requisiciones" sx={tabSx} />
            <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Proyectos" sx={tabSx} />
            <Tab icon={<BadgeIcon />} iconPosition="start" label="Permisos RH" sx={tabSx} />
          </Tabs>
        </Paper>
      )}

      {/* ─── Tab TO DO: Hitos (primer tab por default) ─── */}
      {showHitos && activeTab === 0 && <HitosTab />}

      {/* ─── Tab Requisiciones ─── */}
      {(activeTab === tabRequisiciones || !showProyectos) && (
        <>
          <Paper sx={paperSx}>
            <KpiRow kpiData={kpis} />
          </Paper>

          <Paper sx={paperSx}>
            <DashboardFilters
              filters={filters}
              options={options}
              onChange={setFilter}
              onReset={resetFilters}
              showDepartmentFilter={Boolean(config.showDepartmentFilter)}
            />
          </Paper>

          <Paper sx={paperSx}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : (
              <RfqTable
                rfqs={rfqs}
                mode={mode}
                rfqStatusOptions={options._rfqEnum || []}
                onStatusChanged={reload}
              />
            )}
          </Paper>
        </>
      )}

      {/* ─── Tab Proyectos ─── */}
      {showProyectos && activeTab === tabProyectos && <ProyectosTab mode={mode} />}

      {/* ─── Tab Permisos RH ─── */}
      {showProyectos && activeTab === tabPermisos && <PermisosRHTab />}
    </Box>
  );
}
