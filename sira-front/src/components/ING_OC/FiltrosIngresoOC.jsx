// sira-front/src/components/ING_OC/FiltrosIngresoOC.jsx
import React, { useMemo } from 'react';
import { Paper, Box, TextField, Autocomplete, Button, Typography, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export default function FiltrosIngresoOC({ filterOptions, filters, onFilterChange, onReset }) {

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        // Lógica co-dependiente (Sitio <-> Proyecto)
        if (key === 'sitioId') {
            const proyectoActual = filterOptions.proyectos.find(p => p.id === filters.proyectoId);
            if (proyectoActual && proyectoActual.sitio_id !== value) {
                newFilters.proyectoId = '';
            }
        }
        if (key === 'proyectoId') {
            const proyectoSel = filterOptions.proyectos.find(p => p.id === value);
            if (proyectoSel && filters.sitioId !== proyectoSel.sitio_id) {
                newFilters.sitioId = proyectoSel.sitio_id;
            }
        }
        onFilterChange(newFilters);
    };

    const proyectosFiltrados = useMemo(() => {
        if (!filters?.sitioId) return filterOptions.proyectos || [];
        return (filterOptions.proyectos || []).filter(p => p.sitio_id === filters.sitioId);
    }, [filters?.sitioId, filterOptions.proyectos]);

    // Helper para altura uniforme
    const uniformHeightsSx = {
        '& .MuiInputBase-root': { height: 40 },
        '& .MuiOutlinedInput-input': { p: '10px 14px' },
        '& .MuiButton-root': { height: 40 },
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2, md: 3 },
                mb: 4,
                overflow: 'hidden',
                borderRadius: 4,
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                backgroundImage: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 60%)`,
                boxShadow: (theme) => `0 12px 26px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
        >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                        Filtros avanzados
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Refina la búsqueda por proveedor, ubicación o proyecto para encontrar rápidamente la orden correcta.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={onReset}
                    sx={{
                        mt: { xs: 1, md: 0 },
                        textTransform: 'none',
                        borderRadius: 2,
                        fontWeight: 600,
                    }}
                >
                    Limpiar filtros
                </Button>
            </Stack>
            {/* Usamos Box con display: grid similar a REC_OC */}
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    alignItems: 'center',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: '1fr 1fr',
                        md: 'repeat(6, 1fr)'
                    },
                    ...uniformHeightsSx,
                }}
            >
                {/* Proveedor */}
                <Box>
                    <Autocomplete fullWidth
                        options={filterOptions.proveedores || []}
                        getOptionLabel={(o) => o.marca || ''}
                        value={(filterOptions.proveedores || []).find(p => p.id === filters.proveedorId) || null}
                        onChange={(_, v) => handleFilterChange('proveedorId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Proveedor" placeholder="Todos" />}
                    />
                </Box>
                {/* Sitio */}
                 <Box>
                    <Autocomplete fullWidth
                        options={filterOptions.sitios || []}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={(filterOptions.sitios || []).find(s => s.id === filters.sitioId) || null}
                        onChange={(_, v) => handleFilterChange('sitioId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Sitio" placeholder="Todos" />}
                    />
                </Box>
                {/* Proyecto */}
                 <Box>
                    <Autocomplete fullWidth
                        options={proyectosFiltrados}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={proyectosFiltrados.find(p => p.id === filters.proyectoId) || null}
                        onChange={(_, v) => handleFilterChange('proyectoId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Proyecto" placeholder="Todos" />}
                        disabled={!filterOptions.proyectos?.length}
                    />
                </Box>
                {/* Departamento */}
                 <Box>
                     <Autocomplete fullWidth
                        options={filterOptions.departamentos || []}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={(filterOptions.departamentos || []).find(d => d.id === filters.departamentoId) || null}
                        onChange={(_, v) => handleFilterChange('departamentoId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Depto." placeholder="Todos" />}
                    />
                </Box>
                {/* Búsqueda */}
                <Box>
                    <TextField fullWidth
                        label="Buscar" placeholder="OC o Marca"
                        value={filters.search || ''}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                </Box>
                {/* Reset */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }} />
            </Box>
        </Paper>
    );
}