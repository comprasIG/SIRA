// sira-front/src/components/almacen/DetalleAsignacionesModal.jsx
import React from 'react';
import { Modal, Box, Typography, IconButton, List, ListItem, ListItemText, Divider, CircularProgress, Stack, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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

export default function DetalleAsignacionesModal({ open, onClose, material, asignaciones }) {
    // Determina si los detalles aún están cargando (si asignaciones es null o undefined)
    const isLoading = asignaciones === null || typeof asignaciones === 'undefined';

    return (
        <Modal open={open} onClose={onClose}>
            <ModalBox>
                 {/* Stack para el encabezado */}
                 <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">Detalle Apartado: {material?.material_nombre || 'Cargando...'}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <ContentBox>
                    {isLoading ? <CircularProgress sx={{ display: 'block', margin: 'auto' }} /> :
                     !Array.isArray(asignaciones) || asignaciones.length === 0 ? <Typography>Este material no tiene cantidades apartadas actualmente.</Typography> : (
                        <List dense>
                            {asignaciones.map((asig, index) => (
                                <React.Fragment key={asig.asignacion_id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={`${asig.cantidad} ${material?.unidad_simbolo || ''} - ${asig.proyecto_nombre || 'Proyecto desc.'}`}
                                            secondary={`Sitio: ${asig.sitio_nombre || 'Sitio desc.'} | Costo Unit: ${asig.valor_unitario || 0} ${asig.moneda || ''}`}
                                        />
                                    </ListItem>
                                    {index < asignaciones.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                     )}
                </ContentBox>
                 {/* Stack para el pie de página */}
                <Stack direction="row" justifyContent="flex-end" sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                     <Button onClick={onClose}>Cerrar</Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}