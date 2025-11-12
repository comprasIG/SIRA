// sira-front/src/components/-requisiciones/UnidadFiltros.jsx
import React from 'react';
import { Paper, Box, TextField, Autocomplete, Button, Grid } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const statusOptions = [
  { codigo: 'DISPONIBLE', nombre: 'Disponibles' },
  { codigo: 'EN_SERVICIO', nombre: 'En Servicio / Req. Abierta' },
];

export default function UnidadFiltros({ 
  filters, 
  setFilters, 
  filterOptions, 
  resetFilters, 
  usuarioPuedeVerTodo 
}) {

  const handleFilterChange = (key, value) => {
    // setFilters es la función del hook useUnidades
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        
        {/* Filtro 1: Departamento (Solo si es admin) */}
        {usuarioPuedeVerTodo && (
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={filterOptions.departamentos || []}
              getOptionLabel={(option) => `${option.codigo} - ${option.nombre}` || ''}
              value={filterOptions.departamentos.find(d => d.id === filters.departamentoId) || null}
              onChange={(_e, newValue) => handleFilterChange('departamentoId', newValue ? newValue.id : '')}
              renderInput={(params) => (
                <TextField {...params} label="Departamento" placeholder="Todos" fullWidth size="small" />
              )}
            />
          </Grid>
        )}

        {/* Filtro 2: Marca */}
        <Grid item xs={12} md={usuarioPuedeVerTodo ? 3 : 4}>
          <Autocomplete
            options={filterOptions.marcas || []}
            getOptionLabel={(option) => option || ''} // Es un array de strings
            value={filters.marca || null}
            onChange={(_e, newValue) => handleFilterChange('marca', newValue || '')}
            renderInput={(params) => (
              <TextField {...params} label="Marca" placeholder="Todas" fullWidth size="small" />
            )}
          />
        </Grid>

        {/* Filtro 3: Status */}
        <Grid item xs={12} md={usuarioPuedeVerTodo ? 3 : 4}>
          <Autocomplete
            options={statusOptions}
            getOptionLabel={(option) => option.nombre}
            value={statusOptions.find(s => s.codigo === filters.status) || null}
            onChange={(_e, newValue) => handleFilterChange('status', newValue ? newValue.codigo : '')}
            renderInput={(params) => (
              <TextField {...params} label="Status" placeholder="Todos" fullWidth size="small" />
            )}
          />
        </Grid>

        {/* Botón Limpiar */}
        <Grid item xs={12} md={usuarioPuedeVerTodo ? 2 : 4}>
          <Button
            fullWidth
            variant="outlined"
            size="medium"
            startIcon={<RestartAltIcon />}
            onClick={resetFilters} // Llama a la función del hook
            sx={{ height: '40px' }} // Alinea altura con los textfields
          >
            Limpiar
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}