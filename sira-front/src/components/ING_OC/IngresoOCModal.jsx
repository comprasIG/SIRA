// sira-front/src/components/ING_OC/IngresoOCModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, Button, Stack, CircularProgress, TextField, IconButton, Collapse, Autocomplete, Alert, Tooltip, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const ModalBox = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90vh',
    backgroundColor: theme.palette.background.paper, // Fondo sólido
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
}));

const ContentBox = styled(Box)({
    overflowY: 'auto',
    flexGrow: 1,
    marginTop: 2,
    marginBottom: 2,
});

const ItemRow = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'hasIssue' // Filtra prop 'hasIssue'
})(({ theme, hasIssue }) => ({
    display: 'grid',
    gridTemplateColumns: '1fr auto auto auto auto',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: hasIssue ? theme.palette.error.lighter : 'transparent',
}));


export default function IngresoOCModal({ open, onClose, oc, detalles, loadingDetalles, ubicaciones, tiposIncidencia, onRegistrar }) {

    const [itemsState, setItemsState] = useState([]);
    const [selectedUbicacion, setSelectedUbicacion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (detalles && detalles.length > 0) {
            setItemsState(detalles.map(d => ({
                ...d, // Aquí ya vienen detalle_id, material_id, precio_unitario, moneda
                cantidad_a_ingresar: '',
                showIncidenciaForm: false,
                incidencia: {
                    tipo_id: '',
                    cantidad_afectada: '',
                    descripcion: ''
                }
            })));
        } else {
            setItemsState([]);
        }
        setSelectedUbicacion('');
        setIsSubmitting(false);
    }, [detalles, open]);

    const handleItemChange = (detalle_id, field, value) => {
        setItemsState(prev => prev.map(item =>
            item.detalle_id === detalle_id ? { ...item, [field]: value } : item
        ));
    };

    const handleIncidenciaChange = (detalle_id, field, value) => {
         setItemsState(prev => prev.map(item =>
            item.detalle_id === detalle_id ? { ...item, incidencia: {...item.incidencia, [field]: value} } : item
        ));
    };

    const toggleIncidenciaForm = (detalle_id) => {
         setItemsState(prev => prev.map(item =>
            item.detalle_id === detalle_id ? { ...item, showIncidenciaForm: !item.showIncidenciaForm } : item
        ));
    };

    const handleIngresarTodo = () => {
         setItemsState(prev => prev.map(item => {
            const faltante = Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida));
            return {
                ...item,
                cantidad_a_ingresar: faltante > 0 ? faltante.toString() : '',
                showIncidenciaForm: false,
                incidencia: { tipo_id: '', cantidad_afectada: '', descripcion: '' }
            };
         }));
    };

    const handleSubmit = async () => {
        const isStockProject = oc?.proyecto_nombre === 'STOCK ALMACEN';
        if(isStockProject && !selectedUbicacion) {
            alert('Debes seleccionar una ubicación de destino para ingresos a STOCK.');
            return;
        }

        // --- SECCIÓN MODIFICADA ---
        // Ahora pasamos también precio_unitario y moneda desde el estado del item
        const itemsPayload = itemsState
            .filter(item => parseFloat(item.cantidad_a_ingresar) > 0 || item.incidencia?.tipo_id)
            .map(item => ({
                detalle_id: item.detalle_id,
                material_id: item.material_id,
                cantidad_ingresada_ahora: parseFloat(item.cantidad_a_ingresar) || 0,
                precio_unitario: item.precio_unitario, // <<< AÑADIDO
                moneda: item.moneda,                 // <<< AÑADIDO
                incidencia: item.incidencia?.tipo_id ? {
                    tipo_id: item.incidencia.tipo_id,
                    cantidad_afectada: parseFloat(item.incidencia.cantidad_afectada) || null,
                    descripcion: item.incidencia.descripcion
                } : null
            }));
        // --- FIN SECCIÓN MODIFICADA ---

        if (itemsPayload.length === 0) {
            alert('No has ingresado ninguna cantidad ni reportado incidencias.');
            return;
        }

        const payload = {
            orden_compra_id: oc.id,
            items: itemsPayload,
            ubicacion_id: isStockProject ? selectedUbicacion : null,
        };

        setIsSubmitting(true);
        try {
            await onRegistrar(payload);
        } catch (error) {
           setIsSubmitting(false);
        }
    };

    const isStock = oc?.proyecto_nombre === 'STOCK ALMACEN';

    return (
        <Modal open={open} onClose={onClose}>
            <ModalBox>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Ingreso OC: {oc?.numero_oc}</Typography>
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary">Proveedor: {oc?.proveedor_marca}</Typography>
                <Typography variant="body2" color="text.secondary">Proyecto: {oc?.proyecto_nombre} {isStock && '(Ingreso a STOCK)'}</Typography>

                <ContentBox>
                    {loadingDetalles ? <CircularProgress sx={{ display: 'block', margin: 'auto' }} /> : (
                        <>
                            {isStock && (
                                <Autocomplete sx={{ mb: 2 }}
                                    options={ubicaciones}
                                    getOptionLabel={(o) => `${o.codigo} - ${o.nombre}` || ''}
                                    value={ubicaciones.find(u => u.id === selectedUbicacion) || null}
                                    onChange={(_, v) => setSelectedUbicacion(v?.id || '')}
                                    renderInput={(params) => <TextField {...params} label="Ubicación Destino en Almacén" required />}
                                />
                            )}
                             <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                <Button size="small" onClick={handleIngresarTodo}>Ingresar Todo lo Faltante</Button>
                            </Box>

                            {/* Encabezados */}
                             <ItemRow sx={{ borderBottom: '2px solid black', fontWeight: 'bold' }}>
                                <Typography variant="caption">Material</Typography>
                                <Typography variant="caption" align="right">Pedido</Typography>
                                <Typography variant="caption" align="right">Recibido</Typography>
                                <Typography variant="caption" align="right">Ingresar Ahora</Typography>
                                <Typography variant="caption" align="center">Incidencia</Typography>
                             </ItemRow>

                            {/* Items */}
                            {itemsState.map(item => (
                                <Box key={item.detalle_id}>
                                    <ItemRow hasIssue={!!item.incidencia?.tipo_id}>
                                        <Stack>
                                             <Typography variant="body2">{item.material_nombre}</Typography>
                                             <Typography variant="caption" color="text.secondary">
                                                 {`Faltan: ${Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida))} ${item.unidad_simbolo}`}
                                             </Typography>
                                        </Stack>
                                        <Typography variant="body2" align="right">{item.cantidad_pedida} {item.unidad_simbolo}</Typography>
                                        <Typography variant="body2" align="right">{item.cantidad_recibida} {item.unidad_simbolo}</Typography>
                                        <TextField
                                            size="small" type="number"
                                            value={item.cantidad_a_ingresar}
                                            onChange={(e) => handleItemChange(item.detalle_id, 'cantidad_a_ingresar', e.target.value)}
                                            sx={{ maxWidth: '80px', textAlign: 'right' }}
                                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                                            disabled={!!item.incidencia?.tipo_id}
                                        />
                                        <Tooltip title="Reportar Incidencia">
                                            <Box sx={{ display: 'flex', justifyContent: 'center'}}>
                                                <IconButton size="small" onClick={() => toggleIncidenciaForm(item.detalle_id)} color={item.incidencia?.tipo_id ? 'error' : 'default'}>
                                                    <ReportProblemOutlinedIcon />
                                                </IconButton>
                                            </Box>
                                        </Tooltip>
                                    </ItemRow>
                                    {/* Formulario de Incidencia Colapsable */}
                                    <Collapse in={item.showIncidenciaForm}>
                                        <Paper sx={{ p: 2, my: 1, bgcolor: 'error.lighter', borderLeft: '4px solid', borderColor: 'error.main' }}>
                                            <Typography variant="subtitle2" color="error.dark" gutterBottom>Reportar Incidencia para: {item.material_nombre}</Typography>
                                            <Stack spacing={1}>
                                                <Autocomplete size="small"
                                                    options={tiposIncidencia}
                                                    getOptionLabel={(o) => o.descripcion || ''}
                                                    value={tiposIncidencia.find(t => t.id === item.incidencia.tipo_id) || null}
                                                    onChange={(_, v) => handleIncidenciaChange(item.detalle_id, 'tipo_id', v?.id || '')}
                                                    renderInput={(params) => <TextField {...params} label="Tipo de Incidencia" required />}
                                                />
                                                 <TextField size="small" label="Cantidad Afectada (Opcional)" type="number"
                                                    value={item.incidencia.cantidad_afectada}
                                                    onChange={(e) => handleIncidenciaChange(item.detalle_id, 'cantidad_afectada', e.target.value)}
                                                    inputProps={{ min: 0, step: 'any' }}
                                                />
                                                 <TextField size="small" label="Descripción del Problema" multiline rows={2} required
                                                    value={item.incidencia.descripcion}
                                                     onChange={(e) => handleIncidenciaChange(item.detalle_id, 'descripcion', e.target.value)}
                                                />
                                                <Button size="small" variant="text" color="inherit" sx={{ alignSelf: 'flex-start'}} onClick={() => {
                                                    toggleIncidenciaForm(item.detalle_id);
                                                    handleIncidenciaChange(item.detalle_id, 'tipo_id', '');
                                                    handleIncidenciaChange(item.detalle_id, 'cantidad_afectada', '');
                                                    handleIncidenciaChange(item.detalle_id, 'descripcion', '');
                                                }}>Cancelar Incidencia</Button>
                                            </Stack>
                                        </Paper>
                                    </Collapse>
                                </Box>
                            ))}
                        </>
                    )}
                </ContentBox>

                {/* Footer de Acciones */}
                <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={loadingDetalles || isSubmitting || itemsState.length === 0}
                        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <CheckCircleOutlineIcon />}
                    >
                        {isSubmitting ? 'Registrando...' : 'Registrar Ingreso'}
                    </Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}