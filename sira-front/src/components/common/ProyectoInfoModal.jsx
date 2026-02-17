import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Grid,
    Paper,
    Stack,
    Chip,
    Divider,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Box,
    CircularProgress,
    Tabs,
    Tab,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FlagIcon from '@mui/icons-material/Flag';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DescriptionIcon from '@mui/icons-material/Description';

const formatCurrency = (value, currency = 'MXN') => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    try {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
        }).format(Number(value));
    } catch (error) {
        return `${currency} ${value}`;
    }
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`proyecto-tabpanel-${index}`}
            aria-labelledby={`proyecto-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

export default function ProyectoInfoModal({
    open,
    onClose,
    proyecto,
    hitos = [],
    gastos = [],
    loading = false,
    error = null,
}) {
    const theme = useTheme();
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    if (error) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Error</DialogTitle>
                <DialogContent>
                    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                        <Typography color="error" variant="h6">No se pudo cargar la información</Typography>
                        <Typography variant="body2">{error}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cerrar</Button>
                </DialogActions>
            </Dialog>
        );
    }

    // Safe accessors
    const p = proyecto || {};
    const nombre = p.nombre || 'Proyecto sin nombre';
    const sitio = p.sitio_nombre || 'Sitio no asignado';
    const status = p.status || 'SIN STATUS';
    const descripcion = p.descripcion || 'Sin descripción.';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle
                sx={{
                    px: 4,
                    py: 3,
                    backgroundImage: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.18)} 0%, ${alpha(t.palette.primary.main, 0.05)} 65%, ${t.palette.background.paper} 100%)`,
                    borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                        <Typography variant="overline" sx={{ letterSpacing: 1.4 }} color="primary">
                            Detalle del Proyecto
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="text.primary">
                            {nombre}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {sitio} • {p.cliente_nombre || 'Cliente no disponible'}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Chip label={status} color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
                    </Stack>
                </Stack>
            </DialogTitle>

            <DialogContent dividers sx={{ px: 4, py: 0, minHeight: 400 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            textColor="primary"
                            indicatorColor="primary"
                            sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}
                        >
                            <Tab label="Resumen" icon={<DescriptionIcon fontSize="small" />} iconPosition="start" />
                            <Tab label={`Hitos (${hitos.length})`} icon={<FlagIcon fontSize="small" />} iconPosition="start" />
                            <Tab label={`Gastos (${gastos.length} OCs)`} icon={<ReceiptIcon fontSize="small" />} iconPosition="start" />
                        </Tabs>

                        {/* TAB 0: RESUMEN */}
                        <TabPanel value={tabValue} index={0}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={8}>
                                    <Stack spacing={2}>
                                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Descripción
                                            </Typography>
                                            <Typography variant="body1">
                                                {descripcion}
                                            </Typography>
                                        </Paper>

                                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Fechas y Responsable
                                            </Typography>
                                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                                <Grid item xs={6}>
                                                    <Stack direction="row" spacing={1}>
                                                        <CalendarTodayIcon color="action" fontSize="small" />
                                                        <Box>
                                                            <Typography variant="caption" display="block" color="text.secondary">Fecha Inicio</Typography>
                                                            <Typography variant="body2">{formatDate(p.fecha_inicio)}</Typography>
                                                        </Box>
                                                    </Stack>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Stack direction="row" spacing={1}>
                                                        <CalendarTodayIcon color="action" fontSize="small" />
                                                        <Box>
                                                            <Typography variant="caption" display="block" color="text.secondary">Fecha Cierre</Typography>
                                                            <Typography variant="body2">{formatDate(p.fecha_cierre)}</Typography>
                                                        </Box>
                                                    </Stack>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Divider sx={{ my: 1 }} />
                                                    <Typography variant="caption" display="block" color="text.secondary">Responsable</Typography>
                                                    <Typography variant="body2" fontWeight={500}>{p.responsable_nombre || '-'}</Typography>
                                                    <Typography variant="caption" display="block" color="text.secondary">{p.departamento_nombre || '-'}</Typography>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.04) }}>
                                        <Stack spacing={2}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <AttachMoneyIcon color="success" />
                                                <Typography variant="h6" fontWeight={600}>Finanzas</Typography>
                                            </Stack>
                                            <Divider />
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Total Facturado</Typography>
                                                <Typography variant="h6" color="success.main">
                                                    {formatCurrency(p.total_facturado, p.total_facturado_moneda)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Costo Total</Typography>
                                                <Typography variant="h6" color="text.primary">
                                                    {formatCurrency(p.costo_total, p.costo_total_moneda)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Margen Estimado</Typography>
                                                <Typography variant="h6" color="primary.main">
                                                    {formatCurrency(p.margen_estimado, p.margen_moneda)}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </TabPanel>

                        {/* TAB 1: HITOS */}
                        <TabPanel value={tabValue} index={1}>
                            {hitos.length === 0 ? (
                                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                                    No hay hitos registrados en este proyecto.
                                </Typography>
                            ) : (
                                <Stack spacing={2}>
                                    {hitos.map((hito, idx) => (
                                        <Paper key={hito.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                            <Stack direction="row" alignItems="flex-start" spacing={2}>
                                                <Chip label={`#${idx + 1}`} size="small" />
                                                <Box flex={1}>
                                                    <Typography variant="subtitle1" fontWeight={600}>{hito.nombre}</Typography>
                                                    {hito.descripcion && <Typography variant="body2" color="text.secondary">{hito.descripcion}</Typography>}
                                                </Box>
                                                <Box textAlign="right">
                                                    <Typography variant="caption" display="block" color="text.secondary">Fecha Objetivo</Typography>
                                                    <Typography variant="body2" fontWeight={500}>{formatDate(hito.target_date)}</Typography>
                                                    {hito.fecha_realizacion && (
                                                        <Typography variant="caption" color="success.main" display="block">
                                                            Completado: {formatDate(hito.fecha_realizacion)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </TabPanel>

                        {/* TAB 2: GASTOS (OCs) */}
                        <TabPanel value={tabValue} index={2}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Desglose de Órdenes de Compra asociadas al proyecto.
                            </Typography>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Número OC</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Fecha Creación</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                        <TableCell align="center">Moneda</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {gastos.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                                <Typography color="text.secondary">Sin órdenes de compra registradas.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        gastos.map((gasto) => (
                                            <TableRow key={`${gasto.id}-${gasto.moneda}`} hover>
                                                <TableCell fontWeiht={600}>{gasto.numero_oc}</TableCell>
                                                <TableCell>
                                                    <Chip label={gasto.status} size="small" variant="outlined" color={gasto.status === 'AUTORIZADA' ? 'success' : 'default'} />
                                                </TableCell>
                                                <TableCell>{formatDate(gasto.fecha)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                    {formatCurrency(gasto.total, gasto.moneda)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip label={gasto.moneda} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TabPanel>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 4, py: 3 }}>
                <Button onClick={onClose} variant="contained">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}
