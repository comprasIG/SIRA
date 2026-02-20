import React from 'react';
import {
    Paper, Grid, TextField, MenuItem, Button, InputAdornment, Box
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

export default function FilterSection({ filters, options, onFilterChange, onResetFilters }) {

    const statusOptions = Array.from(new Set(['ABIERTAS', 'TODAS', ...(options?.status || [])]));

    const handleChange = (e) => {
        const { name, value } = e.target;
        onFilterChange(name, value);
    };

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3, width: '100%' }}>
            <Grid container spacing={2} alignItems="center">

                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        name="search"
                        value={filters.search}
                        onChange={handleChange}
                        placeholder="Buscar por OC, marca, razon social, sitio, proyecto o departamento"
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

                <Grid item xs={12} sm={6} md={2}>
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

                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        select
                        fullWidth
                        label="Proyecto"
                        name="proyecto"
                        value={filters.proyecto}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.proyectos || []).map((proyecto) => (
                            <MenuItem key={proyecto.id} value={proyecto.id}>
                                {proyecto.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        select
                        fullWidth
                        label="Sitio"
                        name="sitio"
                        value={filters.sitio}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.sitios || []).map((sitio) => (
                            <MenuItem key={sitio.id} value={sitio.id}>
                                {sitio.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                    <TextField
                        select
                        fullWidth
                        label="Proveedor"
                        name="proveedor"
                        value={filters.proveedor}
                        onChange={handleChange}
                        variant="outlined"
                        size="small"
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {(options?.proveedores || []).map((proveedor) => (
                            <MenuItem key={proveedor.id} value={proveedor.id}>
                                {proveedor.nombre}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
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

                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={onResetFilters}
                            size="small"
                            startIcon={<FilterAltOffIcon fontSize="small" />}
                        >
                            Resetear
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </Paper>
    );
}

