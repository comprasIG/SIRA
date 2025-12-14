import React, { useMemo } from 'react';
import { Typography, Box, Paper, CircularProgress } from '@mui/material';
import KpiRow from './KpiRow';
import DashboardFilters from './DashboardFilters';
import RfqTable from './RfqTable';
import dashboardConfig from './dashboardConfig';
import { useDashboard } from '../../hooks/useDashboard';

export default function DashboardBase({ mode }) {
  const config = useMemo(() => dashboardConfig[mode] || {}, [mode]);

  const {
    loading,
    error,
    kpis,
    rfqs,
    filters,
    options,
    setFilter,
    resetFilters,
  } = useDashboard(mode);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
        {config.title || 'Dashboard'}
      </Typography>

      <Paper sx={{ p: 2 }}>
        <KpiRow kpiData={kpis} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <DashboardFilters
          filters={filters}
          options={options}
          onChange={setFilter}
          onReset={resetFilters}
          showDepartmentFilter={Boolean(config.showDepartmentFilter)}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <RfqTable rfqs={rfqs} />
        )}
      </Paper>
    </Box>
  );
}
