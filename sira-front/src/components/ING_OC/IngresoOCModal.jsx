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
    maxWidth: '800px', // Más ancho para la tabla
    maxHeight: '90vh',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5], // copilot
    padding: theme.spacing(2, 4), // copilot
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
}));

const ContentBox = styled(Box)({
    overflowY: 'auto', // Scroll si el contenido es muy largo
    flexGrow: 1,
    marginTop: 2,
    marginBottom: 2,
});

const ItemRow = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'hasIssue' // Evita pasar 'hasIssue' al DOM
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

    // Inicializa el estado interno cuando cambian los detalles cargados
    useEffect(() => {
        if (detalles && detalles.length > 0) {
            setItemsState(detalles.map(d => ({
                ...d,
                cantidad_a_ingresar: '', // Input para cantidad ahora
                showIncidenciaForm: false,
                incidencia: { // Estado para el formulario de incidencia
                    tipo_id: '',
                    cantidad_afectada: '',
                    descripcion: ''
                }
            })));
        } else {
            setItemsState([]); // Limpia si no hay detalles o se cierra el modal
        }
        setSelectedUbicacion(''); // Resetea ubicación al abrir
        setIsSubmitting(false); // Resetea estado de envío
    }, [detalles, open]); // Depende de 'open' para resetear al reabrir

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
            const faltante = Math.max(0, item.cantidad_pedida - item.cantidad_recibida);
            return {
                ...item,
                cantidad_a_ingresar: faltante > 0 ? faltante.toString() : '', // Solo llena si falta
                showIncidenciaForm: false, // Oculta incidencias
                incidencia: { tipo_id: '', cantidad_afectada: '', descripcion: '' }
            };
         }));
    };

    const handleSubmit = async () => {
        const isStockProject = oc?.proyecto_nombre === 'STOCK ALMACEN'; // Determina si es stock
        if(isStockProject && !selectedUbicacion) {
            alert('Debes seleccionar una ubicación de destino para ingresos a STOCK.');
            return;
        }

        const itemsPayload = itemsState
            .filter(item => parseFloat(item.cantidad_a_ingresar) > 0 || item.incidencia?.tipo_id) // Solo enviar items con cantidad > 0 o incidencia
            .map(item => ({
                detalle_id: item.detalle_id,
                material_id: item.material_id,
                cantidad_ingresada_ahora: parseFloat(item.cantidad_a_ingresar) || 0,
                // Incluir incidencia solo si se seleccionó un tipo
                incidencia: item.incidencia?.tipo_id ? {
                    tipo_id: item.incidencia.tipo_id,
                    cantidad_afectada: parseFloat(item.incidencia.cantidad_afectada) || null, // null si está vacío
                    descripcion: item.incidencia.descripcion
                } : null // null si no hay incidencia reportada
            }));

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
            // El onClose y refresh se manejan en el componente padre (ING_OCForm)
        } catch (error) {
           // El error ya se muestra con toast desde el hook
           setIsSubmitting(false); // Permite reintentar
        }
         // No reseteamos isSubmitting aquí si tiene éxito, porque el modal se cierra
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
                    {loadingDetalles ? <CircularProgress /> : (
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
                             </ItemRow>

                            {/* Items */}
                            {itemsState.map(item => (
                                <Box key={item.detalle_id}>
                                    <ItemRow hasIssue={item.incidencia?.tipo_id}>
                                        <Stack>
                                             <Typography variant="body2">{item.material_nombre}</Typography>
                                             <Typography variant="caption" color="text.secondary">
                                                 {`Faltan: ${Math.max(0, item.cantidad_pedida - item.cantidad_recibida)} ${item.unidad_simbolo}`}
                                             </Typography>
                                        </Stack>
                                        <Typography variant="body2" align="right">{item.cantidad_pedida} {item.unidad_simbolo}</Typography>
                                        <Typography variant="body2" align="right">{item.cantidad_recibida} {item.unidad_simbolo}</Typography>
                                        <TextField
                                            size="small" type="number"
                                            value={item.cantidad_a_ingresar}
                                            onChange={(e) => handleItemChange(item.detalle_id, 'cantidad_a_ingresar', e.target.value)}
                                            sx={{ maxWidth: '80px', textAlign: 'right' }}
                                            inputProps={{ min: 0, step: 'any' }}
                                        />
                                        <Tooltip title="Reportar Incidencia">
                                            <IconButton size="small" onClick={() => toggleIncidenciaForm(item.detalle_id)} color={item.incidencia?.tipo_id ? 'error' : 'default'}>
                                                <ReportProblemOutlinedIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </ItemRow>
                                    {/* Formulario de Incidencia Colapsable */}
                                    <Collapse in={item.showIncidenciaForm}>
                                        <Paper sx={{ p: 2, my: 1, bgcolor: 'error.lighter' }}>
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
                                                />
                                                 <TextField size="small" label="Descripción del Problema" multiline rows={2} required
                                                    value={item.incidencia.descripcion}
                                                     onChange={(e) => handleIncidenciaChange(item.detalle_id, 'descripcion', e.target.value)}
                                                />
                                                <Button size="small" variant="outlined" color="error" onClick={() => handleIncidenciaChange(item.detalle_id, 'tipo_id', '')}>Limpiar Incidencia</Button>
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
                        disabled={loadingDetalles || isSubmitting}
                        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <CheckCircleOutlineIcon />}
                    >
                        {isSubmitting ? 'Registrando...' : 'Registrar Ingreso'}
                    </Button>
                </Stack>
            </ModalBox>
        </Modal>
    );
}