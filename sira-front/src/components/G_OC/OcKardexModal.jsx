import { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Chip, CircularProgress,
    Divider
} from '@mui/material';
import dayjs from 'dayjs';
import api from '../../api/api';

const ACTION_COLORS = {
    'CREACIÓN_OC':                    'primary',
    'MODIFICACIÓN_OC':                'warning',
    'PRE-AUTORIZACIÓN SPEI':          'success',
    'CANCELACIÓN PRE-AUTORIZACIÓN SPEI': 'default',
    'APROBACIÓN A CRÉDITO':           'success',
    'RECHAZO':                        'error',
    'PONER EN HOLD':                  'warning',
    'REANUDAR DESDE HOLD':            'info',
    'CANCELACIÓN OC':                 'error',
    'CANCELACION_POST_APROBACION':    'error',
    'PROCESO_RECOLECCION':            'info',
    'REGISTRO_INGRESO':               'info',
    'CIERRE_AUTOMATICO_ENTREGADA':    'success',
    'ENTREGADA':                      'success',
    'REGISTRO DE PAGO':               'success',
};

function formatDetalles(detalles) {
    if (!detalles) return null;
    const d = typeof detalles === 'string' ? JSON.parse(detalles) : detalles;

    const lines = [];
    if (d.origen)           lines.push(`Origen: ${d.origen}`);
    if (d.motivo)           lines.push(`Motivo: ${d.motivo}`);
    if (d.numero_oc)        lines.push(`Número OC: ${d.numero_oc}`);
    if (d.total != null)    lines.push(`Total: $${Number(d.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    if (d.anterior)         lines.push(`Estado anterior: ${d.anterior}`);
    if (d.nuevo)            lines.push(`Nuevo estado: ${d.nuevo}`);
    if (d.nuevo_estado)     lines.push(`Nuevo estado: ${d.nuevo_estado}`);
    if (d.regresar_en)      lines.push(`Regresar en: ${d.regresar_en}`);
    if (d.fecha_vencimiento_pago) lines.push(`Vencimiento: ${d.fecha_vencimiento_pago}`);
    if (d.monto != null)    lines.push(`Monto: $${Number(d.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    if (d.tipo_pago)        lines.push(`Tipo pago: ${d.tipo_pago}`);
    if (d.accion)           lines.push(`Acción: ${d.accion}`);
    if (d.metodoRecoleccionId) lines.push(`Método recolección ID: ${d.metodoRecoleccionId}`);
    if (d.numeroGuia)       lines.push(`Guía: ${d.numeroGuia}`);
    if (d.rfq_id)           lines.push(`RFQ ID: ${d.rfq_id}`);
    if (d.impo != null)     lines.push(`Importación: ${d.impo ? 'Sí' : 'No'}`);

    // Items de ingreso
    if (Array.isArray(d.items) && d.items.length > 0) {
        lines.push(`Partidas recibidas: ${d.items.length}`);
    }
    // Archivos de recolección
    if (Array.isArray(d.archivos) && d.archivos.length > 0) {
        lines.push(`Archivos: ${d.archivos.length}`);
    }

    return lines.length > 0 ? lines : null;
}

export default function OcKardexModal({ open, oc, onClose }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open || !oc?.id) return;
        setLoading(true);
        setError(null);
        api.get(`/api/ocs/${oc.id}/kardex`)
            .then(res => setRows(res.data))
            .catch(() => setError('Error al cargar el kardex.'))
            .finally(() => setLoading(false));
    }, [open, oc?.id]);

    const numeroOc = oc?.numero_oc || oc?.id || '';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>
                Kardex — {numeroOc}
                <Typography variant="body2" color="text.secondary">
                    Trazabilidad completa de la orden de compra
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}
                {error && (
                    <Typography color="error" sx={{ py: 2 }}>{error}</Typography>
                )}
                {!loading && !error && rows.length === 0 && (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                        Sin movimientos registrados.
                    </Typography>
                )}
                {!loading && !error && rows.map((row, idx) => {
                    const color = ACTION_COLORS[row.accion_realizada] || 'default';
                    const lineas = formatDetalles(row.detalles);
                    return (
                        <Box key={row.id}>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1.5 }}>
                                {/* Línea de tiempo: círculo */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.3 }}>
                                    <Box sx={{
                                        width: 12, height: 12, borderRadius: '50%',
                                        bgcolor: `${color}.main`,
                                        border: '2px solid',
                                        borderColor: `${color}.main`,
                                        flexShrink: 0
                                    }} />
                                    {idx < rows.length - 1 && (
                                        <Box sx={{ width: 2, flexGrow: 1, minHeight: 24, bgcolor: 'divider', mt: 0.5 }} />
                                    )}
                                </Box>

                                {/* Contenido */}
                                <Box sx={{ flexGrow: 1, pb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <Chip
                                            label={row.accion_realizada}
                                            color={color}
                                            size="small"
                                            variant="outlined"
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            {dayjs(row.fecha_registro).format('DD/MM/YYYY HH:mm')}
                                        </Typography>
                                    </Box>
                                    {row.usuario_nombre && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                                            Por: {row.usuario_nombre}
                                        </Typography>
                                    )}
                                    {lineas && (
                                        <Box sx={{ mt: 0.5, pl: 0.5 }}>
                                            {lineas.map((l, i) => (
                                                <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                                    {l}
                                                </Typography>
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                            {idx < rows.length - 1 && <Divider sx={{ ml: 3.5 }} />}
                        </Box>
                    );
                })}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} variant="outlined">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}
