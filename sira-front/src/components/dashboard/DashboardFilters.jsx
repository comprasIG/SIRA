import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export default function DashboardFilters({
  filters,
  options,
  onChange,
  onReset,
  showDepartmentFilter,
}) {
  const controlSx = {
    minWidth: 160,
    flex: '0 1 160px',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Buscador de texto libre */}
      <TextField
        size="small"
        placeholder="Buscar por RFQ, OC, proveedor, usuario, sitio, proyecto, departamento…"
        value={filters.search || ''}
        onChange={(e) => onChange('search', e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ width: '100%' }}
      />

      {/* Filtros de selección */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {showDepartmentFilter && (
          <FormControl size="small" sx={controlSx}>
            <InputLabel>Departamento</InputLabel>
            <Select
              label="Departamento"
              value={filters.departamento_id || ''}
              onChange={(e) => onChange('departamento_id', e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {(options.departamentos || []).map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={controlSx}>
          <InputLabel>Estado RFQ</InputLabel>
          <Select
            label="Estado RFQ"
            value={filters.rfq_status}
            onChange={(e) => onChange('rfq_status', e.target.value)}
          >
            {(options.rfqStatus || ['ACTIVOS']).map((s) => (
              <MenuItem key={s === '' ? '__todos__' : s} value={s}>
                {s === '' ? 'Todos' : s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={controlSx}>
          <InputLabel>Estado OC</InputLabel>
          <Select
            label="Estado OC"
            value={filters.oc_status}
            onChange={(e) => onChange('oc_status', e.target.value)}
          >
            {(options.ocStatus || ['']).map((s) => (
              <MenuItem key={s || '__all__'} value={s}>
                {s === '' ? 'Todos' : s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={controlSx}>
          <InputLabel>Sitio</InputLabel>
          <Select
            label="Sitio"
            value={filters.sitio}
            onChange={(e) => onChange('sitio', e.target.value)}
          >
            {(options.sitios || ['']).map((s) => (
              <MenuItem key={s || '__all__'} value={s}>
                {s === '' ? 'Todos' : s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={controlSx}>
          <InputLabel>Proyecto</InputLabel>
          <Select
            label="Proyecto"
            value={filters.proyecto}
            onChange={(e) => onChange('proyecto', e.target.value)}
          >
            {(options.proyectos || ['']).map((p) => (
              <MenuItem key={p || '__all__'} value={p}>
                {p === '' ? 'Todos' : p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          onClick={onReset}
          sx={{ marginLeft: 'auto' }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
}
