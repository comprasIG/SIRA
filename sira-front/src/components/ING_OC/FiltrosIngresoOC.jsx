// sira-front/src/components/ING_OC/FiltrosIngresoOC.jsx
import React, { useMemo } from 'react';
import { Paper, Box, TextField, Autocomplete, Button } from '@mui/material';
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
        <Paper elevation={2} sx={{ p: 2, mb: 3, overflow: 'hidden' }}>
            {/* Usamos Box con display: grid similar a REC_OC */}
            <Box
                sx={{
                    display: 'grid',
                    gap: 2, // Espaciado entre elementos
                    alignItems: 'center',
                    // Definimos 6 columnas para md y superiores
                    gridTemplateColumns: {
                        xs: '1fr',              // 1 columna en móvil
                        sm: '1fr 1fr',          // 2 columnas en sm
                        md: 'repeat(6, 1fr)'    // 6 columnas iguales en md+
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
                <Box>
                    <Button fullWidth variant="outlined"
                        startIcon={<RestartAltIcon />} onClick={onReset}>
                        Limpiar
                    </Button>
                </Box>
            </Box>
        </Paper>
    );
}