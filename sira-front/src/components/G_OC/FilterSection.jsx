import React from 'react';
import {
    Paper, TextField, MenuItem, Button, InputAdornment, Box
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

/* ── Shared sx for every TextField (search + selects) ─────────────── */
const fieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '10px',
        backgroundColor: '#f8f9fc',
        transition: 'all 0.2s ease',
        '&:hover': {
            backgroundColor: '#f0f2f8',
            boxShadow: '0 2px 8px rgba(26,35,126,0.08)',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#90a4ae',
        },
        '&.Mui-focused': {
            backgroundColor: '#fff',
            boxShadow: '0 0 0 3px rgba(26,35,126,0.10)',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1a237e',
            borderWidth: '2px',
        },
    },
    '& .MuiInputLabel-root': {
        fontSize: '0.92rem',
        color: '#6b7280',
        '&.Mui-focused': {
            color: '#1a237e',
        },
    },
    '& .MuiSelect-select': {
        minHeight: '1.4em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
};

/* ── Wrapper style for each select inside the flex row ────────────── */
const selectWrapperSx = {
    flex: '1 1 180px',   // grow, shrink, basis – never narrower than 180px
    minWidth: 180,
    maxWidth: { xs: '100%', md: 280 },  // cap so long text doesn't blow out
};

export default function FilterSection({ filters, options, onFilterChange, onResetFilters }) {

    const statusOptions = Array.from(new Set(['ABIERTAS', 'TODAS', ...(options?.status || [])]));

    const handleChange = (e) => {
        const { name, value } = e.target;
        onFilterChange(name, value);
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2.5,
                mb: 3,
                width: '100%',
                borderRadius: '14px',
                border: '1px solid #e5e7eb',
                background: '#fff',
            }}
        >
            {/* ── Search bar (full width, own row) ──────────────── */}
            <TextField
                fullWidth
                name="search"
                value={filters.search}
                onChange={handleChange}
                placeholder="Buscar por OC, marca, razon social, sitio, proyecto o departamento"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: '#9ca3af' }} />
                        </InputAdornment>
                    ),
                }}
                variant="outlined"
                sx={{ ...fieldSx, mb: 2 }}
            />

            {/* ── Select filters row (flex-wrap) ───────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    alignItems: 'flex-start',
                }}
            >
                {/* ── Estado ─────────────────────────────── */}
                <Box sx={selectWrapperSx}>
                    <TextField
                        select
                        fullWidth
                        label="Estado"
                        name="status"
                        value={filters.status}
                        onChange={handleChange}
                        variant="outlined"
                        sx={fieldSx}
                    >
                        {statusOptions.map((status) => (
                            <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                    </TextField>
                </Box>

                {/* ── Proyecto ───────────────────────────── */}
                <Box sx={selectWrapperSx}>
                    <TextField
                        select
                        fullWidth
                        label="Proyecto"
                        name="proyecto"
                        value={filters.proyecto}
                        onChange={handleChange}
                        variant="outlined"
                        sx={fieldSx}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.proyectos || []).map((proyecto) => (
                            <MenuItem key={proyecto.id} value={proyecto.id}>
                                {proyecto.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                {/* ── Sitio ──────────────────────────────── */}
                <Box sx={selectWrapperSx}>
                    <TextField
                        select
                        fullWidth
                        label="Sitio"
                        name="sitio"
                        value={filters.sitio}
                        onChange={handleChange}
                        variant="outlined"
                        sx={fieldSx}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.sitios || []).map((sitio) => (
                            <MenuItem key={sitio.id} value={sitio.id}>
                                {sitio.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                {/* ── Proveedor ──────────────────────────── */}
                <Box sx={selectWrapperSx}>
                    <TextField
                        select
                        fullWidth
                        label="Proveedor"
                        name="proveedor"
                        value={filters.proveedor}
                        onChange={handleChange}
                        variant="outlined"
                        sx={fieldSx}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.proveedores || []).map((proveedor) => (
                            <MenuItem key={proveedor.id} value={proveedor.id}>
                                {proveedor.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                {/* ── Ordenar por ────────────────────────── */}
                <Box sx={selectWrapperSx}>
                    <TextField
                        select
                        fullWidth
                        label="Ordenar por"
                        name="sort_by"
                        value={filters.sort_by || 'numero_oc_desc'}
                        onChange={handleChange}
                        variant="outlined"
                        sx={fieldSx}
                    >
                        <MenuItem value="numero_oc_desc">OC (Mayor a Menor)</MenuItem>
                        <MenuItem value="numero_oc_asc">OC (Menor a Mayor)</MenuItem>
                        <MenuItem value="fecha_desc">Fecha (Reciente)</MenuItem>
                        <MenuItem value="fecha_asc">Fecha (Antigua)</MenuItem>
                    </TextField>
                </Box>
            </Box>

            {/* ── Reset button ─────────────────────────────────── */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                    variant="outlined"
                    onClick={onResetFilters}
                    startIcon={<FilterAltOffIcon fontSize="small" />}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '10px',
                        borderColor: '#d1d5db',
                        color: '#4b5563',
                        px: 2.5,
                        py: 0.8,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            borderColor: '#1a237e',
                            color: '#1a237e',
                            backgroundColor: 'rgba(26,35,126,0.04)',
                            boxShadow: '0 2px 8px rgba(26,35,126,0.10)',
                        },
                    }}
                >
                    Resetear
                </Button>
            </Box>
        </Paper>
    );
}
