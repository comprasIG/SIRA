// sira-front/src/components/almacen/FiltrosInventario.jsx
import React, { useMemo } from 'react';
import { Paper, Box, TextField, Autocomplete, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export default function FiltrosInventario({ filters, onFilterChange, onReset, filterOptions }) {

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };

        // Lógica co-dependiente Sitio <-> Proyecto
        if (key === 'sitioId') {
            const proyectoActual = filterOptions.proyectos.find(p => p.id === filters.proyectoId);
            if (proyectoActual && proyectoActual.sitio_id !== value) {
                newFilters.proyectoId = ''; // Resetea proyecto si sitio cambia
            }
        }
        if (key === 'proyectoId') {
            const proyectoSel = filterOptions.proyectos.find(p => p.id === value);
            if (proyectoSel && filters.sitioId !== proyectoSel.sitio_id) {
                newFilters.sitioId = proyectoSel.sitio_id; // Auto-selecciona sitio
            }
        }

        // Deshabilitar Sitio/Proyecto si estado es DISPONIBLE
        if (key === 'estado' && value === 'DISPONIBLE') {
            newFilters.sitioId = '';
            newFilters.proyectoId = '';
        }

        onFilterChange(newFilters);
    };

    const proyectosFiltrados = useMemo(() => {
        if (!filters?.sitioId) return filterOptions.proyectos || [];
        return (filterOptions.proyectos || []).filter(p => p.sitio_id === filters.sitioId);
    }, [filters?.sitioId, filterOptions.proyectos]);

    const showSitioProyecto = filters.estado === 'TODOS' || filters.estado === 'APARTADO';

    const uniformHeightsSx = { /* ... (igual que en FiltrosIngresoOC) ... */ };

    return (
        <Paper elevation={2} sx={{ p: 2, mb: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gap: 2, alignItems: 'center', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)'}, ...uniformHeightsSx }}>
                {/* Buscador */}
                <Box>
                    <TextField fullWidth label="Buscar Material" placeholder="Nombre, SKU..."
                        value={filters.search || ''}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                </Box>
                {/* Estado */}
                <Box>
                    <FormControl fullWidth>
                        <InputLabel>Estado</InputLabel>
                        <Select
                            value={filters.estado || 'TODOS'}
                            label="Estado"
                            onChange={(e) => handleFilterChange('estado', e.target.value)}
                        >
                            <MenuItem value="TODOS">Todos</MenuItem>
                            <MenuItem value="DISPONIBLE">Solo Disponible</MenuItem>
                            <MenuItem value="APARTADO">Solo Apartado</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                {/* Sitio (condicional) */}
                <Box>
                    <Autocomplete fullWidth
                        options={filterOptions.sitios || []}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={(filterOptions.sitios || []).find(s => s.id === filters.sitioId) || null}
                        onChange={(_, v) => handleFilterChange('sitioId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Sitio" placeholder="Todos" />}
                        disabled={!showSitioProyecto}
                    />
                </Box>
                {/* Proyecto (condicional) */}
                <Box>
                    <Autocomplete fullWidth
                        options={proyectosFiltrados}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={proyectosFiltrados.find(p => p.id === filters.proyectoId) || null}
                        onChange={(_, v) => handleFilterChange('proyectoId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Proyecto" placeholder="Todos" />}
                        disabled={!showSitioProyecto || !filters.sitioId} // Deshabilitado si no aplica o no hay sitio
                    />
                </Box>
                {/* Reset */}
                <Box>
                    <Button fullWidth variant="outlined" startIcon={<RestartAltIcon />} onClick={onReset}>
                        Limpiar
                    </Button>
                </Box>
            </Box>
        </Paper>
    );
}