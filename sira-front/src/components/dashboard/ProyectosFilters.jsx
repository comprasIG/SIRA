import React from 'react';
import {
    Box, FormControl, InputLabel, Select, MenuItem,
    Button, Chip, TextField, InputAdornment,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import { PROYECTO_STATUS_COLOR } from './statusColors';

/**
 * Filters for Proyectos tab.
 * Text search + cascading dropdowns: Status, Sitio, Proyecto, Cliente,
 * Responsable, Departamento — all interdependent.
 */
export default function ProyectosFilters({
    filters,
    statusOptions,
    sitioOptions,
    proyectoOptions,
    clienteOptions,
    responsableOptions,
    departamentoOptions,
    onChange,
    onReset,
}) {
    const controlSx = {
        minWidth: 160,
        flex: '1 1 170px',
        '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            transition: 'box-shadow 0.2s ease',
            '&:hover': { boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)' },
            '&.Mui-focused': { boxShadow: '0 2px 12px rgba(99, 102, 241, 0.18)' },
        },
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ── Row 1: Search + label + reset ── */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                    icon={<FilterListIcon />}
                    label="Filtros"
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                />

                <TextField
                    size="small"
                    placeholder="Buscar proyecto, sitio o responsable…"
                    value={filters.search || ''}
                    onChange={(e) => onChange('search', e.target.value)}
                    sx={{
                        flex: '1 1 300px',
                        maxWidth: 420,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'box-shadow 0.2s ease',
                            '&:hover': { boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)' },
                            '&.Mui-focused': { boxShadow: '0 2px 12px rgba(99, 102, 241, 0.18)' },
                        },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <Button
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={onReset}
                    sx={{
                        marginLeft: 'auto',
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        },
                    }}
                >
                    Reset
                </Button>
            </Box>

            {/* ── Row 2: Dropdown filters ── */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Status */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        label="Status"
                        value={filters.status || ''}
                        onChange={(e) => onChange('status', e.target.value)}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="ABIERTOS">
                            <Chip
                                label="Abiertos"
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 'bold', pointerEvents: 'none' }}
                            />
                        </MenuItem>
                        {(statusOptions || []).map((s) => (
                            <MenuItem key={s} value={s}>
                                <Chip
                                    label={s.replace(/_/g, ' ')}
                                    color={PROYECTO_STATUS_COLOR[s] || 'default'}
                                    size="small"
                                    sx={{ fontWeight: 'bold', pointerEvents: 'none' }}
                                />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Sitio */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Sitio</InputLabel>
                    <Select
                        label="Sitio"
                        value={filters.sitio || ''}
                        onChange={(e) => onChange('sitio', e.target.value)}
                    >
                        {(sitioOptions || ['']).map((s) => (
                            <MenuItem key={s || '__all__'} value={s}>
                                {s === '' ? 'Todos' : s}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Proyecto */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Proyecto</InputLabel>
                    <Select
                        label="Proyecto"
                        value={filters.proyecto || ''}
                        onChange={(e) => onChange('proyecto', e.target.value)}
                    >
                        {(proyectoOptions || ['']).map((p) => (
                            <MenuItem key={p || '__all__'} value={p}>
                                {p === '' ? 'Todos' : p}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Cliente */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Cliente</InputLabel>
                    <Select
                        label="Cliente"
                        value={filters.cliente || ''}
                        onChange={(e) => onChange('cliente', e.target.value)}
                    >
                        {(clienteOptions || ['']).map((c) => (
                            <MenuItem key={c || '__all__'} value={c}>
                                {c === '' ? 'Todos' : c}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Responsable */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Responsable</InputLabel>
                    <Select
                        label="Responsable"
                        value={filters.responsable || ''}
                        onChange={(e) => onChange('responsable', e.target.value)}
                    >
                        {(responsableOptions || ['']).map((r) => (
                            <MenuItem key={r || '__all__'} value={r}>
                                {r === '' ? 'Todos' : r}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Departamento */}
                <FormControl size="small" sx={controlSx}>
                    <InputLabel>Departamento</InputLabel>
                    <Select
                        label="Departamento"
                        value={filters.departamento || ''}
                        onChange={(e) => onChange('departamento', e.target.value)}
                    >
                        {(departamentoOptions || ['']).map((d) => (
                            <MenuItem key={d || '__all__'} value={d}>
                                {d === '' ? 'Todos' : d}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
        </Box>
    );
}
