import React from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import ProyectosKpiRow from './ProyectosKpiRow';
import ProyectosFilters from './ProyectosFilters';
import ProyectosTable from './ProyectosTable';
import { useProyectosDashboard } from '../../hooks/useProyectosDashboard';

/* Polished Paper styling matching DashboardBase */
const paperSx = {
    p: 2,
    borderRadius: 3,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.3s ease',
    '&:hover': {
        boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)',
    },
};

/**
 * Tab de Proyectos: KPIs + Cascading Filters + Table.
 */
export default function ProyectosTab({ mode }) {
    const {
        loading,
        error,
        proyectos,
        kpis,
        filters,
        statusOptions,
        sitioOptions,
        proyectoOptions,
        clienteOptions,
        responsableOptions,
        departamentoOptions,
        setFilter,
        resetFilters,
        updateStatus,
    } = useProyectosDashboard(mode);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Paper sx={paperSx}>
                <ProyectosKpiRow kpis={kpis} />
            </Paper>

            <Paper sx={paperSx}>
                <ProyectosFilters
                    filters={filters}
                    statusOptions={statusOptions}
                    sitioOptions={sitioOptions}
                    proyectoOptions={proyectoOptions}
                    clienteOptions={clienteOptions}
                    responsableOptions={responsableOptions}
                    departamentoOptions={departamentoOptions}
                    onChange={setFilter}
                    onReset={resetFilters}
                />
            </Paper>

            <Paper sx={paperSx}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={36} />
                    </Box>
                ) : error ? (
                    <Typography color="error">{error}</Typography>
                ) : (
                    <ProyectosTable
                        proyectos={proyectos}
                        statusOptions={statusOptions}
                        onStatusChange={updateStatus}
                    />
                )}
            </Paper>
        </Box>
    );
}
