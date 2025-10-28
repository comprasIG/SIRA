// sira-front/src/components/almacen/ApartarStockModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Box, Typography, Button, Stack, CircularProgress, TextField, Autocomplete, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { styled } from '@mui/material/styles';

const ModalBox = styled(Box)(({ theme }) => ({ /* ... (igual que antes) ... */ }));
const ContentBox = styled(Box)({ /* ... (igual que antes) ... */ });

export default function ApartarStockModal({ open, onClose, material, filterOptions, onSubmit, isSubmitting }) {
    const [cantidad, setCantidad] = useState('');
    const [selectedSitio, setSelectedSitio] = useState(null);
    const [selectedProyecto, setSelectedProyecto] = useState(null);

    const stockDisponible = parseFloat(material?.total_stock) || 0;
    const unidad = material?.unidad_simbolo || '';

     // Limpia estado al abrir/cerrar
    useEffect(() => {
        if(open) {
            setCantidad('');
            setSelectedSitio(null);
            setSelectedProyecto(null);
        }
    }, [open]);

    const proyectosFiltrados = useMemo(() => {
        if (!selectedSitio) return [];
        return (filterOptions.proyectos || []).filter(p => p.sitio_id === selectedSitio.id);
    }, [selectedSitio, filterOptions.proyectos]);

     useEffect(() => { // Limpia proyecto si cambia sitio
        if(selectedSitio && selectedProyecto && selectedProyecto.sitio_id !== selectedSitio.id) {
            setSelectedProyecto(null);
        }
    }, [selectedSitio, selectedProyecto]);

    const handleCantidadChange = (value) => {
        const inputQty = parseFloat(value) || 0;
        const finalQty = Math.max(0, Math.min(inputQty, stockDisponible));
        setCantidad(finalQty === 0 ? '' : finalQty.toString());
    };

    const handleSubmit = () => {
        const cantidadNum = parseFloat(cantidad);
        if (!selectedSitio || !selectedProyecto || !cantidadNum || cantidadNum <= 0) {
            alert('Completa todos los campos: Sitio, Proyecto y Cantidad (mayor a 0).');
            return;
        }
        onSubmit({
            material_id: material.material_id,
            cantidad: cantidadNum,
            sitio_id: selectedSitio.id,
            proyecto_id: selectedProyecto.id,
        });
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalBox sx={{ maxWidth: 600 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Apartar Stock: {material?.material_nombre}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Disponible: {stockDisponible} {unidad}
                </Typography>
                <ContentBox>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                         <Autocomplete fullWidth
                            options={filterOptions.sitios || []}
                            getOptionLabel={(o) => o.nombre || ''}
                            value={selectedSitio}
                            onChange={(_, v) => setSelectedSitio(v)}
                            renderInput={(params) => <TextField {...params} label="Sitio Destino" required />}
                        />
                         <Autocomplete fullWidth
                            options={proyectosFiltrados}
                            getOptionLabel={(o) => o.nombre || ''}
                            value={selectedProyecto}
                            onChange={(_, v) => setSelectedProyecto(v)}
                            renderInput={(params) => <TextField {...params} label="Proyecto Destino" required />}
                            disabled={!selectedSitio}
                        />
                         <TextField
                            fullWidth label={`Cantidad a Apartar (${unidad})`} type="number"
                            value={cantidad}
                            onChange={(e) => handleCantidadChange(e.target.value)}
                            required
                            inputProps={{ max: stockDisponible, min: 0, step: 'any' }}
                            helperText={`Máximo: ${stockDisponible}`}
                            error={parseFloat(cantidad) > stockDisponible}
                        />
                    </Stack>
                </ContentBox>
                <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button
                        variant="contained" color="success"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedSitio || !selectedProyecto || !cantidad || parseFloat(cantidad) <= 0}
                        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <CheckCircleOutlineIcon />}
                    >
                        {isSubmitting ? 'Apartando...' : 'Confirmar Apartado'}
                    </Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}

// Reemplaza los estilos de ModalBox y ContentBox si los copiaste