// sira-front/src/components/PICK_IN/RetiroStock.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Autocomplete, TextField, Button, CircularProgress, Stack } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export default function RetiroStock({
    filterOptions,
    stockInfo,
    loadingStock,
    fetchStockMaterial,
    registrarRetiro,
    isSubmitting,
}) {
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [cantidadRetirar, setCantidadRetirar] = useState('');
    const [selectedSitioDest, setSelectedSitioDest] = useState(null);
    const [selectedProyectoDest, setSelectedProyectoDest] = useState(null);

    // Llama a fetchStockMaterial cuando cambia el material seleccionado
    useEffect(() => {
        if (selectedMaterial) {
            fetchStockMaterial(selectedMaterial.id);
        } else {
            fetchStockMaterial(null); // Limpia la info si no hay material
        }
    }, [selectedMaterial, fetchStockMaterial]);

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


    const handleQuantityChange = (value) => {
        const maxQty = parseFloat(stockInfo?.stock_total) || 0;
        const inputQty = parseFloat(value) || 0;
        const finalQty = Math.max(0, Math.min(inputQty, maxQty));
        setCantidadRetirar(finalQty === 0 ? '' : finalQty.toString());
    };

    const handleSubmit = async () => {
        if (!selectedMaterial || !cantidadRetirar || !selectedSitioDest || !selectedProyectoDest) {
            alert('Debes seleccionar material, cantidad, sitio y proyecto de destino.');
            return;
        }

        const cantidadNum = parseFloat(cantidadRetirar);
        if (cantidadNum <= 0) {
             alert('La cantidad a retirar debe ser mayor a cero.');
             return;
        }

         const payload = {
            tipoRetiro: 'STOCK',
            items: [{
                material_id: selectedMaterial.id,
                cantidad_a_retirar: cantidadNum,
            }],
            proyectoDestinoId: selectedProyectoDest.id,
            sitioDestinoId: selectedSitioDest.id,
        };

        const success = await registrarRetiro(payload);
         if(success) {
            // Limpiar formulario
            setSelectedMaterial(null);
            setCantidadRetirar('');
            setSelectedSitioDest(null);
            setSelectedProyectoDest(null);
            // fetchStockMaterial(null); // El useEffect limpiará
        }
    };

    const stockTotal = parseFloat(stockInfo?.stock_total) || 0;
    const unidad = selectedMaterial?.unidad_simbolo || '';

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Retirar Material de Stock General</Typography>
            <Stack spacing={3}>
                <Autocomplete fullWidth
                    options={filterOptions.materialesEnStock || []}
                    getOptionLabel={(o) => o.nombre || ''}
                    value={selectedMaterial}
                    onChange={(_, v) => setSelectedMaterial(v)}
                    renderInput={(params) => <TextField {...params} label="Buscar Material en Stock" />}
                />

                {selectedMaterial && (
                    <>
                        {loadingStock ? <CircularProgress size={24} /> : (
                            <Typography variant="body2" color="text.secondary">
                                Stock Total Disponible: <strong>{stockTotal} {unidad}</strong>
                            </Typography>
                        )}

                        <TextField
                            fullWidth label={`Cantidad a Retirar (${unidad})`} type="number"
                            value={cantidadRetirar}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            disabled={loadingStock || stockTotal <= 0}
                            inputProps={{ max: stockTotal, min: 0, step: 'any' }}
                            helperText={stockTotal <= 0 ? "No hay stock disponible para este material." : ""}
                            error={stockTotal <= 0}
                        />

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

                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={isSubmitting || loadingStock || cantidadRetirar <= 0 || !selectedSitioDest || !selectedProyectoDest}
                            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                        >
                           {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro de Stock'}
                        </Button>
                    </>
                )}
            </Stack>
        </Box>
    );
}