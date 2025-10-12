// sira-front/src/components/REC_OC/FiltrosRecoleccion.jsx
import React, { useMemo } from 'react';
import { Paper, Box, TextField, Autocomplete, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export default function FiltrosRecoleccion({ filterOptions, filters, onFilterChange, onReset }) {
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };

    // Lógica para limpiar el proyecto si el sitio cambia (se mantiene)
    if (key === 'sitioId') {
      const proyectoActual = filterOptions.proyectos.find(p => p.id === filters.proyectoId);
      if (proyectoActual && proyectoActual.sitio_id !== value) {
        newFilters.proyectoId = '';
      }
    }

    onFilterChange(newFilters);
  };

  // Lista de proyectos filtrados por sitio (se mantiene)
  const proyectosFiltrados = useMemo(() => {
    if (!filters?.sitioId) return filterOptions.proyectos || [];
    return (filterOptions.proyectos || []).filter(p => p.sitio_id === filters.sitioId);
  }, [filters?.sitioId, filterOptions.proyectos]);

  // Helper para altura uniforme de controles
  const uniformHeightsSx = {
    '& .MuiInputBase-root': { height: 40 },
    '& .MuiOutlinedInput-input': { p: '10px 14px' },
    '& .MuiButton-root': { height: 40 },
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'grid',
          gap: 3, // equivalente a spacing={3} del Grid en el dashboard
          alignItems: 'center',
          gridTemplateColumns: {
            xs: '1fr',         // 1 columna en móvil
            sm: '1fr 1fr',     // 2 columnas en sm
            md: 'repeat(5, 1fr)' // 5 columnas iguales en md+
          },
          ...uniformHeightsSx,
        }}
      >
        {/* Proveedor */}
        <Box>
          <Autocomplete
            options={filterOptions.proveedores || []}
            getOptionLabel={(option) => option?.marca || ''}
            value={(filterOptions.proveedores || []).find(p => p.id === filters?.proveedorId) || null}
            onChange={(_e, newValue) => handleFilterChange('proveedorId', newValue ? newValue.id : '')}
            renderInput={(params) => (
              <TextField {...params} label="Proveedor" placeholder="Selecciona proveedor" fullWidth />
            )}
          />
        </Box>

        {/* Sitio */}
        <Box>
          <Autocomplete
            options={filterOptions.sitios || []}
            getOptionLabel={(option) => option?.nombre || ''}
            value={(filterOptions.sitios || []).find(s => s.id === filters?.sitioId) || null}
            onChange={(_e, newValue) => handleFilterChange('sitioId', newValue ? newValue.id : '')}
            renderInput={(params) => (
              <TextField {...params} label="Sitio" placeholder="Selecciona sitio" fullWidth />
            )}
          />
        </Box>

        {/* Proyecto (filtrado por sitio) */}
        <Box>
          <Autocomplete
            options={proyectosFiltrados}
            getOptionLabel={(option) => option?.nombre || ''}
            value={proyectosFiltrados.find(p => p.id === filters?.proyectoId) || null}
            onChange={(_e, newValue) => handleFilterChange('proyectoId', newValue ? newValue.id : '')}
            renderInput={(params) => (
              <TextField {...params} label="Proyecto" placeholder="Selecciona proyecto" fullWidth />
            )}
          />
        </Box>

        {/* Buscar (texto libre) */}
        <Box>
          <TextField
            fullWidth
            label="Buscar"
            placeholder="Material, OC, comentario…"
            value={filters?.buscar ?? filters?.search ?? ''}
            onChange={(e) => {
              const key = (filters && Object.prototype.hasOwnProperty.call(filters, 'buscar'))
                ? 'buscar'
                : (filters && Object.prototype.hasOwnProperty.call(filters, 'search'))
                ? 'search'
                : 'buscar';
              handleFilterChange(key, e.target.value);
            }}
          />
        </Box>

        {/* Limpiar */}
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
