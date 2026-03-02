import { useState, useMemo } from 'react';
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
    IconButton,
    Avatar,
    AvatarGroup,
    Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FlagIcon from '@mui/icons-material/Flag';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import NuevoProyectoForm from '../-p-m-o/proyectos/NuevoProyectoForm';
import OCInfoModal from './OCInfoModal';
import RFQInfoModal from './RFQInfoModal';
import { useOcPreview } from '../../hooks/useOcPreview';
import { useRfqPreview } from '../../hooks/useRfqPreview';
import { RFQ_STATUS_COLOR, OC_STATUS_COLOR } from '../dashboard/statusColors';

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
    const [editOpen, setEditOpen] = useState(false);

    const ocPreview  = useOcPreview();
    const rfqPreview = useRfqPreview();

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Calculate Expenses by Currency
    const gastosPorMoneda = useMemo(() => {
        if (!gastos || gastos.length === 0) return [];
        const totals = gastos.reduce((acc, g) => {
            const moneda = g.moneda || 'MXN';
            const total = Number(g.total) || 0;
            acc[moneda] = (acc[moneda] || 0) + total;
            return acc;
        }, {});
        return Object.entries(totals).map(([moneda, total]) => ({ moneda, total }));
    }, [gastos]);

    // Group flat gastos rows (OC+moneda) into RFQ → OC[] structure
    const gastosPorRfq = useMemo(() => {
        if (!gastos || gastos.length === 0) return [];
        const map = new Map();
        for (const g of gastos) {
            const rfqKey = g.rfq_id != null ? `rfq_${g.rfq_id}` : `oc_${g.id}`;
            if (!map.has(rfqKey)) {
                map.set(rfqKey, {
                    rfq_id: g.rfq_id,
                    numero_requisicion: g.numero_requisicion,
                    rfq_status: g.rfq_status,
                    ocs: new Map(),
                });
            }
            const grupo = map.get(rfqKey);
            if (!grupo.ocs.has(g.id)) {
                grupo.ocs.set(g.id, {
                    id: g.id,
                    numero_oc: g.numero_oc,
                    status: g.status,
                    fecha_aprobacion: g.fecha_aprobacion,
                    totales: [],
                });
            }
            grupo.ocs.get(g.id).totales.push({ moneda: g.moneda, total: g.total });
        }
        return Array.from(map.values()).map(g => ({ ...g, ocs: Array.from(g.ocs.values()) }));
    }, [gastos]);

    const handleEditSuccess = () => {
        setEditOpen(false);
        // Ideally we should refresh the data here.
        // For now, we close the edit dialog.
        // The user might need to close and reopen the modal or refresh the page to see changes.
        // We can call onClose() to close the info modal too, forcing a refresh on next open?
        // Let's keep the info modal open but maybe show a message or just close the edit dialog.
        // Actually, closing the info modal is safer to avoid stale data display.
        onClose();
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

    // Prepare initial values for the form
    const initialValues = useMemo(() => {
        if (!p) return null;
        return {
            ...p,
            hitos: hitos, // Pass current hitos
        };
    }, [p, hitos]);

    return (
        <>
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
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setEditOpen(true)}
                                sx={{ border: 1, borderColor: 'primary.main' }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
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
                                <Tab label={`Gastos (${gastosPorRfq.length})`} icon={<ReceiptIcon fontSize="small" />} iconPosition="start" />
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

                                                {gastosPorMoneda.length > 0 && (
                                                    <>
                                                        <Divider />
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                Gasto por Moneda (OCs)
                                                            </Typography>
                                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                                {gastosPorMoneda.map((g) => (
                                                                    <Chip
                                                                        key={g.moneda}
                                                                        label={`${g.moneda} ${formatCurrency(g.total, g.moneda).replace(g.moneda, '').trim()}`}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="default"
                                                                    />
                                                                ))}
                                                            </Stack>
                                                        </Box>
                                                    </>
                                                )}
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
                                        {hitos.map((hito, idx) => {
                                            const responsables = Array.isArray(hito.responsables) ? hito.responsables : [];
                                            const isRealizado = !!hito.fecha_realizacion;
                                            return (
                                            <Paper key={hito.id} variant="outlined" sx={{ p: 2, borderRadius: 2, opacity: isRealizado ? 0.8 : 1 }}>
                                                <Stack direction="row" alignItems="flex-start" spacing={2}>
                                                    <Chip label={`#${idx + 1}`} size="small" color={isRealizado ? 'success' : 'default'} />
                                                    <Box flex={1}>
                                                        <Typography variant="subtitle1" fontWeight={600} sx={{ textDecoration: isRealizado ? 'line-through' : 'none' }}>{hito.nombre}</Typography>
                                                        {hito.descripcion && <Typography variant="body2" color="text.secondary">{hito.descripcion}</Typography>}
                                                        {responsables.length > 0 && (
                                                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
                                                                <Typography variant="caption" color="text.disabled">Resp.:</Typography>
                                                                <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: '0.55rem' } }}>
                                                                    {responsables.map((r) => (
                                                                        <Tooltip key={r.id} title={r.nombre}>
                                                                            <Avatar sx={{ width: 20, height: 20, fontSize: '0.55rem', bgcolor: 'primary.main' }}>
                                                                                {(r.nombre || '?')[0].toUpperCase()}
                                                                            </Avatar>
                                                                        </Tooltip>
                                                                    ))}
                                                                </AvatarGroup>
                                                                {responsables.length === 1 && (
                                                                    <Typography variant="caption" color="text.secondary">{responsables[0].nombre}</Typography>
                                                                )}
                                                            </Stack>
                                                        )}
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
                                            );
                                        })}
                                    </Stack>
                                )}
                            </TabPanel>

                            {/* TAB 2: GASTOS — agrupado por RFQ */}
                            <TabPanel value={tabValue} index={2}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Desglose de Requisiciones y Órdenes de Compra asociadas al proyecto.
                                </Typography>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Num RFQ</TableCell>
                                            <TableCell>Status RFQ</TableCell>
                                            <TableCell>Órdenes de Compra</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {gastosPorRfq.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                                    <Typography color="text.secondary">Sin órdenes de compra registradas.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            gastosPorRfq.map((grupo) => {
                                                const rfqKey = grupo.rfq_id != null ? `rfq_${grupo.rfq_id}` : `oc_${grupo.ocs[0]?.id}`;
                                                return (
                                                    <TableRow key={rfqKey} hover>
                                                        <TableCell>
                                                            {grupo.rfq_id ? (
                                                                <Chip
                                                                    label={grupo.numero_requisicion}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color="info"
                                                                    onClick={() => rfqPreview.openPreview({ rfq_id: grupo.rfq_id, id: grupo.rfq_id })}
                                                                    sx={{ cursor: 'pointer', fontWeight: 600, fontFamily: 'monospace' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="caption" color="text.secondary">Sin RFQ</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {grupo.rfq_status ? (
                                                                <Chip
                                                                    label={grupo.rfq_status}
                                                                    size="small"
                                                                    color={RFQ_STATUS_COLOR[grupo.rfq_status] || 'default'}
                                                                    sx={{ fontWeight: 'bold' }}
                                                                />
                                                            ) : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                {grupo.ocs.map((oc) => {
                                                                    const totalStr = oc.totales.map(t =>
                                                                        `${t.moneda} ${formatCurrency(t.total, t.moneda)}`
                                                                    ).join(' + ');
                                                                    const fechaStr = oc.fecha_aprobacion
                                                                        ? `Aprobada: ${formatDate(oc.fecha_aprobacion)}`
                                                                        : 'Sin fecha de aprobación';
                                                                    return (
                                                                        <Tooltip key={oc.id} title={`${fechaStr} · ${totalStr}`} arrow>
                                                                            <Chip
                                                                                label={oc.numero_oc}
                                                                                size="small"
                                                                                variant="outlined"
                                                                                color={OC_STATUS_COLOR[oc.status] || 'default'}
                                                                                onClick={() => ocPreview.openPreview({ id: oc.id, numero_oc: oc.numero_oc })}
                                                                                sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
                                                                            />
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
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

            {/* OC detail modal */}
            <OCInfoModal
                open={ocPreview.previewOpen}
                onClose={ocPreview.closePreview}
                oc={ocPreview.previewOc}
                items={ocPreview.previewItems}
                metadata={ocPreview.previewMetadata}
                loading={ocPreview.loading}
            />

            {/* RFQ detail modal */}
            <RFQInfoModal
                open={rfqPreview.previewOpen}
                onClose={rfqPreview.closePreview}
                rfq={rfqPreview.previewRfq}
                items={rfqPreview.previewItems}
                metadata={rfqPreview.previewMetadata}
                attachments={rfqPreview.previewAttachments}
                loading={rfqPreview.loading}
            />

            {/* Edit Dialog */}
            <Dialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { bgcolor: '#f8fafc', p: 0 } // Match NuevoProyectoForm background
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 4 }}>
                        <NuevoProyectoForm
                            proyectoId={p?.id}
                            initialValues={initialValues}
                            onSuccess={handleEditSuccess}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 4, justifyContent: 'center' }}>
                    <Button onClick={() => setEditOpen(false)} color="inherit">
                        Cancelar Edición
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
