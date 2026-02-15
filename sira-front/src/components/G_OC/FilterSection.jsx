
import React from 'react';
import {
    Paper, Grid, TextField, MenuItem, Button, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

export default function FilterSection({ filters, options, onFilterChange, onResetFilters }) {

    const statusOptions = Array.from(new Set(['ABIERTAS', 'TODAS', ...(options?.status || [])]));
    const filteredSitios = options?.sitios
        ?.filter(s => !filters.proyecto || !s.proyecto_id || String(s.proyecto_id) === String(filters.proyecto))
        || [];
    const hasProjectScopedSites = options?.sitios?.some(s => s.proyecto_id);

    const handleChange = (e) => {
        const { name, value } = e.target;
        onFilterChange(name, value);
    };

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3, width: '100%' }}>
            <Grid container spacing={2} alignItems="center">

                {/* Search Bar */}
                <Grid item xs={12} sm={6} md={4}>
                    <TextField
                        fullWidth
                        name="search"
                        value={filters.search}
                        onChange={handleChange}
                        placeholder="Buscar..."
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        }}
                        variant="outlined"
                        size="small"
                    />
                </Grid>

                {/* Status Filter */}
                <Grid item xs={6} sm={6} md={3}>
                    <TextField
                        select
                        fullWidth
                        label="Estado"
                        name="status"
                        value={filters.status}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                    >
                        {statusOptions.map((status) => (
                            <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                    </TextField>
                </Grid>

                {/* Sort Control */}
                <Grid item xs={6} sm={6} md={3}>
                    <TextField
                        select
                        fullWidth
                        label="Ordenar por"
                        name="sort_by"
                        value={filters.sort_by || 'numero_oc_desc'}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                    >
                        <MenuItem value="numero_oc_desc">OC (Mayor a Menor)</MenuItem>
                        <MenuItem value="numero_oc_asc">OC (Menor a Mayor)</MenuItem>
                        <MenuItem value="fecha_desc">Fecha (Reciente)</MenuItem>
                        <MenuItem value="fecha_asc">Fecha (Antigua)</MenuItem>
                    </TextField>
                </Grid>

                {/* Reset Button - Inline */}
                <Grid item xs={6} sm={6} md={2}>
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={onResetFilters}
                        size="small"
                        fullWidth
                        sx={{ height: '40px' }}
                    >
                        <FilterAltOffIcon fontSize="small" />
                    </Button>
                </Grid>

                {/* Proyecto Filter - Wide row */}
                <Grid item xs={12} md={6}>
                    <TextField
                        select
                        fullWidth
                        label="Proyecto"
                        name="proyecto"
                        value={filters.proyecto}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: { md: 260 } }}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {options?.proyectos?.map((proy) => (
                            <MenuItem key={proy.id || proy} value={proy.id || proy}>
                                {proy.nombre || proy}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                {/* Sitio Filter - Dependent */}
                <Grid item xs={12} md={6}>
                    <TextField
                        select
                        fullWidth
                        label="Sitio"
                        name="sitio"
                        value={filters.sitio}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                        disabled={!filters.proyecto && hasProjectScopedSites}
                        sx={{ minWidth: { md: 260 } }}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {filteredSitios.map((sitio) => (
                            <MenuItem key={sitio.id || sitio} value={sitio.id || sitio}>
                                {sitio.nombre || sitio}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

            </Grid>
        </Paper>
    );
}
