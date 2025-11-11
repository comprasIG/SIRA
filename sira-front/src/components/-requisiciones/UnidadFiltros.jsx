// sira-front/src/components/-requisiciones/UnidadFiltros.jsx
import React from 'react';
import { Paper, Box, TextField, Autocomplete, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export default function UnidadFiltros({ filters, setFilters, options }) {

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' },
        }}
      >
        <Autocomplete
          options={options}
          getOptionLabel={(option) => `${option.codigo} - ${option.nombre}` || ''}
          value={options.find(d => d.codigo === filters.departamentoId) || null}
          onChange={(_e, newValue) => handleFilterChange('departamentoId', newValue ? newValue.codigo : '')}
          renderInput={(params) => (
            <TextField {...params} label="Filtrar por Departamento" placeholder="Todos" fullWidth size="small" />
          )}
        />
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={() => handleFilterChange('departamentoId', '')}
        >
          Limpiar
        </Button>
      </Box>
    </Paper>
  );
}