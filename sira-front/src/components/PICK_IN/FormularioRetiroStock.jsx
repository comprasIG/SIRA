// sira-front/src/components/PICK_IN/RetiroStock.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
    Box,
    Typography,
    Autocomplete,
    TextField,
    Stack,
    Collapse,
    Paper,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FormularioRetiroStock from './FormularioRetiroStock';

/**
 * RetiroStock
 *
 * Componente para retirar materiales de stock general. Incluye selección
 * de destino (sitio y proyecto) y despliega un formulario condicional
 * una vez que ambos destinos han sido seleccionados. Se ha envuelto
 * todo el contenido en un contenedor `Paper` con bordes redondeados y
 * degradado para una apariencia coherente con el resto de la aplicación.
 */
export default function RetiroStock(props) {
    // Extraemos todos los props del hook principal
    const { filterOptions } = props;
    const theme = useTheme();

    // Estado local solo para el destino
    const [selectedSitioDest, setSelectedSitioDest] = useState(null);
    const [selectedProyectoDest, setSelectedProyectoDest] = useState(null);

    // Lógica para filtrar proyectos co-dependientes
    const proyectosDestFiltrados = useMemo(() => {
        if (!selectedSitioDest) return [];
        return (filterOptions.todosProyectos || []).filter((p) => p.sitio_id === selectedSitioDest.id);
    }, [selectedSitioDest, filterOptions.todosProyectos]);

    useEffect(() => {
        if (
            selectedSitioDest &&
            selectedProyectoDest &&
            selectedProyectoDest.sitio_id !== selectedSitioDest.id
        ) {
            setSelectedProyectoDest(null);
        }
    }, [selectedSitioDest, selectedProyectoDest]);

    const destinoSeleccionado = selectedSitioDest && selectedProyectoDest;

    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 60%)`,
                boxShadow: `0 12px 26px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
        >
            <Box>
                <Typography variant="h6" gutterBottom>
                    Retirar Material de Stock General
                </Typography>

                {/* --- SECCIÓN 1: DESTINO --- */}
                <Stack spacing={3}>
                    <Typography variant="subtitle1">1. Selecciona el Destino</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <Autocomplete
                            fullWidth
                            options={filterOptions.todosSitios || []}
                            getOptionLabel={(o) => o.nombre || ''}
                            value={selectedSitioDest}
                            onChange={(_, v) => setSelectedSitioDest(v)}
                            renderInput={(params) => <TextField {...params} label="Sitio Destino" required />}
                        />
                        <Autocomplete
                            fullWidth
                            options={proyectosDestFiltrados}
                            getOptionLabel={(o) => o.nombre || ''}
                            value={selectedProyectoDest}
                            onChange={(_, v) => setSelectedProyectoDest(v)}
                            renderInput={(params) => <TextField {...params} label="Proyecto Destino" required />}
                            disabled={!selectedSitioDest}
                        />
                    </Stack>

                    {/* --- SECCIÓN 2: MATERIALES (CONDICIONAL) --- */}
                    <Collapse in={destinoSeleccionado} timeout="auto" unmountOnExit>
                        <FormularioRetiroStock
                            // Pasamos el destino y todos los props del hook al formulario
                            sitioDestinoId={selectedSitioDest?.id}
                            proyectoDestinoId={selectedProyectoDest?.id}
                            {...props} // Pasa registrarRetiro, isSubmitting, materialesEnStock, etc.
                        />
                    </Collapse>
                </Stack>
            </Box>
        </Paper>
    );
}