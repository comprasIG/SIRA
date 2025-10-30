// sira-front/src/components/almacen/ApartarStockModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Box, Typography, Button, Stack, CircularProgress, TextField, Autocomplete, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { styled } from '@mui/material/styles';

// Definición completa de ModalBox
const ModalBox = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 600,
    maxHeight: '90vh',
    backgroundColor: theme.palette.background.paper, // Fondo sólido
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
}));

// Definición completa de ContentBox
const ContentBox = styled(Box)({
    overflowY: 'auto',
    flexGrow: 1,
    marginTop: 2,
    marginBottom: 2,
});

export default function ApartarStockModal({ open, onClose, material, filterOptions, onSubmit, isSubmitting }) {
    const [cantidad, setCantidad] = useState('');
    const [selectedSitio, setSelectedSitio] = useState(null);
    const [selectedProyecto, setSelectedProyecto] = useState(null);

    // Usa total_stock del material pasado como prop
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

    // Usa todosProyectos y todosSitios pasados desde el hook padre
    const proyectosFiltrados = useMemo(() => {
        if (!selectedSitio) return [];
        return (filterOptions.todosProyectos || []).filter(p => p.sitio_id === selectedSitio.id);
    }, [selectedSitio, filterOptions.todosProyectos]);

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
            <ModalBox>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Apartar Stock: {material?.material_nombre || 'Cargando...'}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Disponible: {stockDisponible} {unidad}
                </Typography>
                <ContentBox>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                         <Autocomplete fullWidth
                            options={filterOptions.todosSitios || []} // Usa todos los sitios
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
                        disabled={isSubmitting || !selectedSitio || !selectedProyecto || !cantidad || parseFloat(cantidad) <= 0 || parseFloat(cantidad) > stockDisponible}
                        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <CheckCircleOutlineIcon />}
                    >
                        {isSubmitting ? 'Apartando...' : 'Confirmar Apartado'}
                    </Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}