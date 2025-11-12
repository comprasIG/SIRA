// sira-front/src/components/PICK_IN/RetiroStock.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Autocomplete, TextField, Button, CircularProgress, Stack,
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper,
    Collapse, InputAdornment // <<< --- CORRECCIÓN AQUÍ
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';

export default function RetiroStock({
    filterOptions,
    // stockInfo, // Ya no se usa
    // loadingStock, // Ya no se usa
    // fetchStockMaterial, // Ya no se usa
    registrarRetiro,
    isSubmitting,
}) {
    // --- NUEVO ESTADO ---
    // Sección 1: Destino
    const [selectedSitioDest, setSelectedSitioDest] = useState(null);
    const [selectedProyectoDest, setSelectedProyectoDest] = useState(null);

    // Sección 2: Materiales
    const [searchTerm, setSearchTerm] = useState(''); // Para el filtro rápido
    const [itemsParaRetirar, setItemsParaRetirar] = useState({}); // { [material_id]: cantidad_a_retirar }

    // --- FIN NUEVO ESTADO ---

    // Filtra proyectos basado en sitio destino
     const proyectosDestFiltrados = useMemo(() => {
        if (!selectedSitioDest) return [];
        return (filterOptions.todosProyectos || []).filter(p => p.sitio_id === selectedSitioDest.id);
    }, [selectedSitioDest, filterOptions.todosProyectos]);

    // Limpia proyecto si cambia sitio destino
     useEffect(() => {
        if(selectedSitioDest && selectedProyectoDest && selectedProyectoDest.sitio_id !== selectedSitioDest.id) {
            setSelectedProyectoDest(null);
        }
    }, [selectedSitioDest, selectedProyectoDest]);

    // --- NUEVA LÓGICA DE FILTRADO VISUAL ---
    const materialesFiltrados = useMemo(() => {
        const stockDisponible = filterOptions.materialesEnStock || [];
        if (!searchTerm) {
            return stockDisponible; // Devuelve todo si no hay búsqueda
        }
        // Usamos unaccent en el frontend (simple)
        const lowerSearchTerm = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return stockDisponible.filter(material =>
            material.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerSearchTerm)
        );
    }, [searchTerm, filterOptions.materialesEnStock]);

    // --- NUEVO MANEJADOR DE CANTIDAD PARA LA TABLA ---
    const handleQuantityChange = (material_id, stock_total, value) => {
        const maxQty = parseFloat(stock_total) || 0;
        const inputQty = parseFloat(value) || 0;
        // Permite escribir 0 o un número mayor al max, pero lo valida visualmente (con error)
        // Solo bloquea negativos
        const finalQty = Math.max(0, inputQty);

        setItemsParaRetirar(prev => ({
            ...prev,
            [material_id]: finalQty.toString()
        }));
    };

    // --- LÓGICA DE ENVÍO MODIFICADA ---
    const handleSubmit = async () => {
        if (!selectedSitioDest || !selectedProyectoDest) {
            alert('Debes seleccionar un Sitio y Proyecto de destino.');
            return;
        }

        let hasError = false;
        // Transforma el objeto de estado en el array que espera la API
        const itemsPayload = Object.entries(itemsParaRetirar)
            .map(([material_id, cantidad_a_retirar]) => {
                const cantidadNum = parseFloat(cantidad_a_retirar);
                const material = filterOptions.materialesEnStock.find(m => m.id === parseInt(material_id));
                const stockTotal = parseFloat(material?.stock_total) || 0;

                // Validación antes de enviar
                if (cantidadNum > stockTotal) {
                    toast.error(`Cantidad para "${material.nombre}" excede el stock disponible.`);
                    hasError = true;
                }
                
                return {
                    material_id: parseInt(material_id),
                    cantidad_a_retirar: cantidadNum
                };
            })
            .filter(item => item.cantidad_a_retirar > 0); // Filtra los que tengan cantidad > 0

        if (hasError) {
            return; // Detiene el envío si hay errores de cantidad
        }

        if (itemsPayload.length === 0) {
            alert('No has ingresado ninguna cantidad para retirar.');
            return;
        }

         const payload = {
            tipoRetiro: 'STOCK',
            items: itemsPayload,
            proyectoDestinoId: selectedProyectoDest.id,
            sitioDestinoId: selectedSitioDest.id,
        };

        const success = await registrarRetiro(payload);
         if(success) {
            // Limpiar formulario
            // Mantenemos el destino por si quiere retirar más cosas
            setItemsParaRetirar({});
            setSearchTerm('');
            // No refrescamos los filtros aquí, registrarRetiro lo hace
        }
    };

    const destinoSeleccionado = selectedSitioDest && selectedProyectoDest;

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Retirar Material de Stock General</Typography>
            
            {/* --- SECCIÓN 1: DESTINO --- */}
            <Stack spacing={3}>
                <Typography variant="subtitle1">1. Selecciona el Destino</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                     <Autocomplete fullWidth
                        options={filterOptions.todosSitios || []}
                        getOptionLabel={(o) => o.nombre || ''}
                        value={selectedSitioDest}
                        onChange={(_, v) => setSelectedSitioDest(v)}
                        renderInput={(params) => <TextField {...params} label="Sitio Destino" required />}
                    />
                    <Autocomplete fullWidth
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
                    <Stack spacing={2}>
                        <Typography variant="subtitle1" sx={{ mt: 2 }}>2. Selecciona Materiales y Cantidades</Typography>
                        
                        {/* Filtro rápido */}
                        <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            label="Buscar material en la lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: 'text.disabled' }} />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Tabla de Materiales */}
                        <Paper variant="outlined">
                            <TableContainer sx={{ maxHeight: 440 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Material</TableCell>
                                            <TableCell align="right">Stock Total</TableCell>
                                            <TableCell align="right">Unidad</TableCell>
                                            <TableCell align="center" sx={{ width: '150px' }}>Cantidad a Retirar</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {materialesFiltrados.map((item) => {
                                            const stockTotal = parseFloat(item.stock_total) || 0;
                                            const cantidadInput = parseFloat(itemsParaRetirar[item.id]) || 0;
                                            const hasError = cantidadInput > stockTotal;

                                            return (
                                                <TableRow key={item.id} hover selected={hasError}>
                                                    <TableCell>{item.nombre}</TableCell>
                                                    <TableCell align="right">{stockTotal}</TableCell>
                                                    <TableCell align="right">{item.unidad_simbolo}</TableCell>
                                                    <TableCell align="center">
                                                        <TextField
                                                            size="small" type="number"
                                                            variant="outlined"
                                                            value={itemsParaRetirar[item.id] || ''}
                                                            onChange={(e) => handleQuantityChange(item.id, stockTotal, e.target.value)}
                                                            sx={{ width: '120px' }}
                                                            inputProps={{
                                                                // max: stockTotal, // Quitamos max para permitir error visual
                                                                min: 0, step: 'any',
                                                                style: { textAlign: 'right' }
                                                            }}
                                                            error={hasError}
                                                            helperText={hasError ? `Max: ${stockTotal}` : ''}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                        
                        {/* Botón de Submit */}
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={isSubmitting || Object.keys(itemsParaRetirar).filter(k => parseFloat(itemsParaRetirar[k]) > 0).length === 0}
                            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                            sx={{ alignSelf: 'flex-end', mt: 2 }}
                        >
                           {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro de Stock'}
                        </Button>
                    </Stack>
                </Collapse>
            </Stack>
        </Box>
    );
}