// sira-front/src/components/almacen/DetalleAsignacionesModal.jsx
import React from 'react';
import { Modal, Box, Typography, IconButton, List, ListItem, ListItemText, Divider, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '@mui/material/styles';

const ModalBox = styled(Box)(({ theme }) => ({ /* ... (igual que en IngresoOCModal) ... */ }));
const ContentBox = styled(Box)({ /* ... (igual que en IngresoOCModal) ... */ });

export default function DetalleAsignacionesModal({ open, onClose, material, asignaciones }) {
    return (
        <Modal open={open} onClose={onClose}>
            <ModalBox sx={{ maxWidth: 600 }}> {/* Un poco más pequeño */}
                 <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Detalle Apartado: {material?.material_nombre}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <ContentBox>
                    {asignaciones === null ? <CircularProgress sx={{ display: 'block', margin: 'auto' }} /> :
                     asignaciones.length === 0 ? <Typography>Este material no tiene cantidades apartadas actualmente.</Typography> : (
                        <List dense>
                            {asignaciones.map((asig, index) => (
                                <React.Fragment key={asig.asignacion_id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={`${asig.cantidad} ${material?.unidad_simbolo || ''} - ${asig.proyecto_nombre || 'Proyecto desc.'}`}
                                            secondary={`Sitio: ${asig.sitio_nombre || 'Sitio desc.'} | Costo Unit: ${asig.valor_unitario} ${asig.moneda || ''}`}
                                        />
                                    </ListItem>
                                    {index < asignaciones.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))}
                        </List>
                     )}
                </ContentBox>
                <Box sx={{ pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                     <Button onClick={onClose}>Cerrar</Button>
                </Box>
            </ModalBox>
        </Modal>
    );
}

// Reemplaza los estilos de ModalBox y ContentBox con los usados en IngresoOCModal si los copiaste