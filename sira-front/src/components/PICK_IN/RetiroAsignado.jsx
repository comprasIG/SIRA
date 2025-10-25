// sira-front/src/components/PICK_IN/RetiroAsignado.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Autocomplete, TextField, Button, CircularProgress, Stack, Checkbox, FormControlLabel } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export default function RetiroAsignado({
    filterOptions,
    materialesAsignados,
    loadingAsignados,
    fetchMaterialesAsignados,
    registrarRetiro,
    isSubmitting,
}) {
    const [selectedSitio, setSelectedSitio] = useState(null);
    const [selectedProyecto, setSelectedProyecto] = useState(null);
    const [itemsToWithdraw, setItemsToWithdraw] = useState({}); // { [asignacion_id]: cantidad }

    // Filtra proyectos basados en el sitio seleccionado
    const proyectosFiltrados = useMemo(() => {
        if (!selectedSitio) return [];
        return (filterOptions.proyectosAsignados || []).filter(p => p.sitio_id === selectedSitio.id);
    }, [selectedSitio, filterOptions.proyectosAsignados]);

    // Llama a fetchMaterialesAsignados cuando cambian sitio o proyecto
    useEffect(() => {
        if (selectedSitio && selectedProyecto) {
            fetchMaterialesAsignados(selectedSitio.id, selectedProyecto.id);
            setItemsToWithdraw({}); // Limpia selección al cambiar proyecto/sitio
        } else {
            // Limpia la lista si no hay sitio o proyecto
            // fetchMaterialesAsignados(null, null); // El hook ya maneja esto
        }
    }, [selectedSitio, selectedProyecto, fetchMaterialesAsignados]);

     // Limpia proyecto si cambia el sitio y el proyecto no pertenece
    useEffect(() => {
        if(selectedSitio && selectedProyecto && selectedProyecto.sitio_id !== selectedSitio.id) {
            setSelectedProyecto(null);
        }
    }, [selectedSitio, selectedProyecto]);

    const handleQuantityChange = (asignacion_id, value) => {
        const material = materialesAsignados.find(m => m.asignacion_id === asignacion_id);
        if (!material) return;
        const maxQty = parseFloat(material.cantidad_asignada_pendiente);
        const inputQty = parseFloat(value) || 0;
        const finalQty = Math.max(0, Math.min(inputQty, maxQty)); // Asegura 0 <= qty <= max

        setItemsToWithdraw(prev => ({ ...prev, [asignacion_id]: finalQty.toString() }));
    };

    const handleSelectAll = () => {
         const newItems = {};
         materialesAsignados.forEach(item => {
             newItems[item.asignacion_id] = item.cantidad_asignada_pendiente.toString();
         });
         setItemsToWithdraw(newItems);
    };

     const handleCheckboxChange = (asignacion_id, checked) => {
        if (checked) {
            const material = materialesAsignados.find(m => m.asignacion_id === asignacion_id);
            if(material) {
                handleQuantityChange(asignacion_id, material.cantidad_asignada_pendiente);
            }
        } else {
            // Elimina la propiedad si se desmarca
            setItemsToWithdraw(prev => {
                const newState = {...prev};
                delete newState[asignacion_id];
                return newState;
            });
        }
    };

    const handleSubmit = async () => {
        const itemsPayload = Object.entries(itemsToWithdraw)
            .map(([asignacion_id, cantidad_a_retirar]) => {
                const material = materialesAsignados.find(m => m.asignacion_id === parseInt(asignacion_id));
                return material ? {
                    asignacion_id: parseInt(asignacion_id),
                    material_id: material.material_id,
                    cantidad_a_retirar: parseFloat(cantidad_a_retirar),
                    valor_unitario: parseFloat(material.valor_unitario),
                    ubicacion_id: material.ubicacion_id // Necesario para actualizar inventario_actual.asignado
                } : null;
            })
            .filter(item => item && item.cantidad_a_retirar > 0); // Filtra nulos y cantidades 0

        if (itemsPayload.length === 0) {
            alert('No has seleccionado materiales o cantidades a retirar.');
            return;
        }

        const payload = {
            tipoRetiro: 'ASIGNADO',
            items: itemsPayload,
            proyectoDestinoId: selectedProyecto.id, // El proyecto al que está asignado
            sitioDestinoId: selectedSitio.id,       // El sitio al que está asignado
        };

        const success = await registrarRetiro(payload);
        if(success) {
            // Limpiar selección después de éxito
             setSelectedSitio(null);
             setSelectedProyecto(null);
             setItemsToWithdraw({});
             // fetchMaterialesAsignados(null, null); // El useEffect limpiará la lista
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Retirar Material Asignado</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Autocomplete fullWidth
                    options={filterOptions.sitiosAsignados || []}
                    getOptionLabel={(o) => o.nombre || ''}
                    value={selectedSitio}
                    onChange={(_, v) => setSelectedSitio(v)}
                    renderInput={(params) => <TextField {...params} label="Seleccionar Sitio" />}
                />
                <Autocomplete fullWidth
                    options={proyectosFiltrados}
                    getOptionLabel={(o) => o.nombre || ''}
                    value={selectedProyecto}
                    onChange={(_, v) => setSelectedProyecto(v)}
                    renderInput={(params) => <TextField {...params} label="Seleccionar Proyecto" />}
                    disabled={!selectedSitio}
                />
            </Stack>

            {loadingAsignados && <CircularProgress sx={{ display: 'block', margin: 'auto' }} />}

            {!loadingAsignados && selectedSitio && selectedProyecto && (
                <>
                    {materialesAsignados.length === 0 ? (
                        <Typography>No hay materiales asignados pendientes para este proyecto/sitio.</Typography>
                    ) : (
                        <Stack spacing={1}>
                             <Box sx={{ display: 'flex', justifyContent: 'flex-end'}}>
                                 <Button size="small" onClick={handleSelectAll}>Seleccionar Todo</Button>
                             </Box>
                             {materialesAsignados.map((item) => (
                                <Stack key={item.asignacion_id} direction="row" spacing={2} alignItems="center"
                                       sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                    <Checkbox
                                        checked={!!itemsToWithdraw[item.asignacion_id]}
                                        onChange={(e) => handleCheckboxChange(item.asignacion_id, e.target.checked)}
                                    />
                                    <Typography sx={{ flexGrow: 1 }}>{item.material_nombre}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {`Disp: ${item.cantidad_asignada_pendiente} ${item.unidad_simbolo}`}
                                    </Typography>
                                    <TextField
                                        size="small" type="number"
                                        label="Retirar"
                                        value={itemsToWithdraw[item.asignacion_id] || ''}
                                        onChange={(e) => handleQuantityChange(item.asignacion_id, e.target.value)}
                                        sx={{ width: '100px' }}
                                        inputProps={{
                                            max: item.cantidad_asignada_pendiente,
                                            min: 0, step: 'any'
                                        }}
                                        disabled={!itemsToWithdraw[item.asignacion_id]} // Deshabilita si no está chequeado
                                    />
                                </Stack>
                            ))}
                            <Button
                                sx={{ mt: 3 }}
                                variant="contained"
                                onClick={handleSubmit}
                                disabled={isSubmitting || Object.keys(itemsToWithdraw).length === 0}
                                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                            >
                                {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro Asignado'}
                            </Button>
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}