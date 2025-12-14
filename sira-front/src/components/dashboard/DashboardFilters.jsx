import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';

export default function DashboardFilters({
  filters,
  options,
  onChange,
  onReset,
  showDepartmentFilter,
}) {
  const controlSx = {
    minWidth: 180,
    flex: '0 1 180px',
  };

  return (
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
          value={filters.rfq_status || 'ACTIVOS'}
          onChange={(e) => onChange('rfq_status', e.target.value)}
        >
          {(options.rfqStatus || ['ACTIVOS']).map((s) => (
            <MenuItem key={s} value={s}>
              {s === '' ? 'Todos' : s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={controlSx}>
        <InputLabel>Estado OC</InputLabel>
        <Select
          label="Estado OC"
          value={filters.oc_status || ''}
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
          value={filters.sitio || ''}
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
          value={filters.proyecto || ''}
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
  );
}
