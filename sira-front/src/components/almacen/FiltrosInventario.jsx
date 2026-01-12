// sira-front/src/components/almacen/FiltrosInventario.jsx
import React, { useMemo } from 'react';
import {
    Paper,
    Box,
    TextField,
    Autocomplete,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * FiltrosInventario
 *
 * Componente de filtros para la página de Inventario. Este componente
 * implementa una rejilla responsive de filtros junto con un botón para
 * limpiar la selección. Se ha actualizado la apariencia para que sea
 * consistente con el resto de la aplicación, utilizando un contenedor
 * `Paper` sin elevación, bordes redondeados y un degradado sutil como
 * fondo. Además, se eliminó el overflow oculto para asegurar que los
 * textos completos se muestren correctamente en todos los campos.
 */
export default function FiltrosInventario({ filters, onFilterChange, onReset, filterOptions }) {
    const theme = useTheme();

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };

        // Lógica co-dependiente Sitio <-> Proyecto
        if (key === 'sitioId') {
            const proyectoActual = filterOptions.proyectos.find((p) => p.id === filters.proyectoId);
            if (proyectoActual && proyectoActual.sitio_id !== value) {
                newFilters.proyectoId = '';
            }
        }
        if (key === 'proyectoId') {
            const proyectoSel = filterOptions.proyectos.find((p) => p.id === value);
            if (proyectoSel && filters.sitioId !== proyectoSel.sitio_id) {
                newFilters.sitioId = proyectoSel.sitio_id;
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
        return (filterOptions.proyectos || []).filter((p) => p.sitio_id === filters.sitioId);
    }, [filters?.sitioId, filterOptions.proyectos]);

    const showSitioProyecto = filters.estado === 'TODOS' || filters.estado === 'APARTADO';

    // Ajustamos las alturas de los controles para mantener uniformidad y legibilidad
    const uniformHeightsSx = {
        '& .MuiInputBase-root': { height: 40 },
        '& .MuiOutlinedInput-input': { p: '10px 14px' },
        '& .MuiButton-root': { height: 40 },
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2, sm: 3 },
                mb: 3,
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 60%)`,
                boxShadow: `0 12px 26px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    alignItems: 'center',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: '1fr 1fr',
                        md: 'repeat(5, 1fr)',
                    },
                    ...uniformHeightsSx,
                }}
            >
                {/* Buscador */}
                <Box>
                    <TextField
                        fullWidth
                        label="Buscar Material"
                        placeholder="Nombre, SKU..."
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
                    <Autocomplete
                        fullWidth
                        options={filterOptions.sitios || []}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={(filterOptions.sitios || []).find((s) => s.id === filters.sitioId) || null}
                        onChange={(_, v) => handleFilterChange('sitioId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Sitio" placeholder="Todos" />}
                        disabled={!showSitioProyecto}
                    />
                </Box>
                {/* Proyecto (condicional) */}
                <Box>
                    <Autocomplete
                        fullWidth
                        options={proyectosFiltrados}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={proyectosFiltrados.find((p) => p.id === filters.proyectoId) || null}
                        onChange={(_, v) => handleFilterChange('proyectoId', v?.id || '')}
                        renderInput={(params) => <TextField {...params} label="Proyecto" placeholder="Todos" />}
                        disabled={!showSitioProyecto || !filters.sitioId}
                    />
                </Box>
                {/* Reset */}
                <Box>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<RestartAltIcon />}
                        onClick={onReset}
                    >
                        Limpiar
                    </Button>
                </Box>
            </Box>
        </Paper>
    );
}