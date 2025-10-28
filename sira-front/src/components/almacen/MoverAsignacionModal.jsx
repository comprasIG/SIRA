// sira-front/src/components/almacen/MoverAsignacionModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Box, Typography, Button, Stack, CircularProgress, TextField, Autocomplete, IconButton, List, ListItem, ListItemText, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { styled } from '@mui/material/styles';

const ModalBox = styled(Box)(({ theme }) => ({ /* ... (igual que antes) ... */ }));
const ContentBox = styled(Box)({ /* ... (igual que antes) ... */ });

export default function MoverAsignacionModal({ open, onClose, material, filterOptions, getDetalleAsignaciones, onSubmit, isSubmitting }) {
    const [asignaciones, setAsignaciones] = useState([]);
    const [loadingAsignaciones, setLoadingAsignaciones] = useState(true);
    const [selectedAsignacionId, setSelectedAsignacionId] = useState(''); // ID de la fila en inventario_asignado
    const [selectedSitio, setSelectedSitio] = useState(null);
    const [selectedProyecto, setSelectedProyecto] = useState(null);

    useEffect(() => {
        if (open && material) {
            setLoadingAsignaciones(true);
            setSelectedAsignacionId('');
            setSelectedSitio(null);
            setSelectedProyecto(null);
            getDetalleAsignaciones(material.material_id)
                .then(data => setAsignaciones(data || []))
                .finally(() => setLoadingAsignaciones(false));
        }
    }, [open, material, getDetalleAsignaciones]);

    const proyectosFiltrados = useMemo(() => {
        if (!selectedSitio) return [];
        return (filterOptions.proyectos || []).filter(p => p.sitio_id === selectedSitio.id);
    }, [selectedSitio, filterOptions.proyectos]);

     useEffect(() => { // Limpia proyecto si cambia sitio
        if(selectedSitio && selectedProyecto && selectedProyecto.sitio_id !== selectedSitio.id) {
            setSelectedProyecto(null);
        }
    }, [selectedSitio, selectedProyecto]);

    const handleSubmit = () => {
         if (!selectedAsignacionId || !selectedSitio || !selectedProyecto) {
            alert('Debes seleccionar la asignación a mover y el nuevo sitio/proyecto.');
            return;
        }
        onSubmit({
            asignacion_id: parseInt(selectedAsignacionId),
            nuevo_sitio_id: selectedSitio.id,
            nuevo_proyecto_id: selectedProyecto.id,
        });
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalBox sx={{ maxWidth: 700 }}>
                 <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Mover Asignación: {material?.material_nombre}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <ContentBox>
                    {loadingAsignaciones ? <CircularProgress /> : (
                        <Stack spacing={3} sx={{ mt: 2 }}>
                            <FormControl component="fieldset">
                                <FormLabel component="legend">1. Selecciona la asignación actual a mover:</FormLabel>
                                {asignaciones.length === 0 ? <Typography variant="body2" color="text.secondary">No hay asignaciones para mover de este material.</Typography> : (
                                    <RadioGroup
                                        value={selectedAsignacionId}
                                        onChange={(e) => setSelectedAsignacionId(e.target.value)}
                                    >
                                        <List dense sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                            {asignaciones.map((asig) => (
                                                <ListItem key={asig.asignacion_id} disablePadding>
                                                    <FormControlLabel
                                                        value={String(asig.asignacion_id)}
                                                        control={<Radio size="small" />}
                                                        label={`${asig.cantidad} ${material?.unidad_simbolo || ''} - ${asig.proyecto_nombre} (${asig.sitio_nombre})`}
                                                        sx={{ width: '100%', ml: 0 }}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </RadioGroup>
                                )}
                            </FormControl>

                            <Typography variant="subtitle1">2. Selecciona el nuevo destino:</Typography>
                             <Autocomplete fullWidth
                                options={filterOptions.sitios || []} // Usamos todos los sitios como posible destino
                                getOptionLabel={(o) => o.nombre || ''}
                                value={selectedSitio}
                                onChange={(_, v) => setSelectedSitio(v)}
                                renderInput={(params) => <TextField {...params} label="Nuevo Sitio Destino" required />}
                                disabled={!selectedAsignacionId} // Deshabilita hasta seleccionar origen
                            />
                            <Autocomplete fullWidth
                                options={proyectosFiltrados}
                                getOptionLabel={(o) => o.nombre || ''}
                                value={selectedProyecto}
                                onChange={(_, v) => setSelectedProyecto(v)}
                                renderInput={(params) => <TextField {...params} label="Nuevo Proyecto Destino" required />}
                                disabled={!selectedSitio} // Deshabilita hasta seleccionar sitio
                            />
                        </Stack>
                    )}
                </ContentBox>
                 <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button
                        variant="contained" color="warning"
                        onClick={handleSubmit}
                        disabled={loadingAsignaciones || isSubmitting || !selectedAsignacionId || !selectedSitio || !selectedProyecto}
                        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <CheckCircleOutlineIcon />}
                    >
                        {isSubmitting ? 'Moviendo...' : 'Confirmar Movimiento'}
                    </Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}

// Reemplaza los estilos de ModalBox y ContentBox si los copiaste