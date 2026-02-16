import React, { useMemo } from 'react';
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
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Box,
    CircularProgress,
    Link,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { RFQ_STATUS_COLOR } from '../dashboard/statusColors';

export default function RFQInfoModal({
    open,
    onClose,
    rfq,
    items = [],
    metadata = [],
    attachments = [],
    loading = false,
}) {
    const theme = useTheme();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle
                sx={{
                    px: 4,
                    py: 3,
                    backgroundImage: (t) => `linear-gradient(135deg, ${alpha(t.palette.secondary.main, 0.1)} 0%, ${alpha(t.palette.secondary.main, 0.02)} 100%)`,
                    borderBottom: (t) => `1px solid ${alpha(t.palette.secondary.main, 0.08)}`,
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                        <Typography variant="overline" sx={{ letterSpacing: 1.4 }} color="secondary">
                            Requisición de Material
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="text.primary">
                            {rfq?.numero_requisicion || rfq?.rfq_code || 'RFQ sin folio'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Creado el: {rfq?.fecha_creacion ? new Date(rfq.fecha_creacion).toLocaleDateString() : '-'}
                        </Typography>
                    </Box>
                    <Box>
                        {rfq?.status && (
                            <Chip
                                label={rfq.status}
                                color={RFQ_STATUS_COLOR[rfq.status] || 'default'}
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                            />
                        )}
                    </Box>
                </Stack>
            </DialogTitle>
            <DialogContent
                dividers
                sx={{
                    px: 4,
                    py: 3.5,
                    backgroundColor: '#f9fafb',
                }}
            >
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress color="secondary" />
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        {/* Metadata Section */}
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2.5,
                                borderRadius: 2,
                                backgroundColor: 'white',
                            }}
                        >
                            <Grid container spacing={2}>
                                {metadata.map((entry) => (
                                    <Grid item xs={12} sm={6} md={4} key={entry.label}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {entry.label}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={500}>
                                            {entry.value}
                                        </Typography>
                                    </Grid>
                                ))}
                                {rfq?.comentario_general && (
                                    <Grid item xs={12}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Comentarios Generales
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                            {rfq.comentario_general}
                                        </Typography>
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>

                        {/* Attachments Section */}
                        {attachments.length > 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <AttachFileIcon fontSize="small" color="action" />
                                    <Typography variant="subtitle2">Adjuntos</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {attachments.map((file) => (
                                        <Chip
                                            key={file.id}
                                            label={file.nombre_archivo}
                                            component="a"
                                            href={file.ruta_archivo}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            clickable
                                            variant="outlined"
                                            size="small"
                                        />
                                    ))}
                                </Stack>
                            </Paper>
                        )}

                        {/* Items Table */}
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <Box
                                sx={{
                                    px: 3,
                                    py: 1.5,
                                    backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                                    borderBottom: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                                }}
                            >
                                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                    Materiales Solicitados
                                </Typography>
                            </Box>
                            <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>SKU</TableCell>
                                            <TableCell>Descripción</TableCell>
                                            <TableCell align="right">Cantidad</TableCell>
                                            <TableCell align="center">Unidad</TableCell>
                                            <TableCell>Comentarios</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        No hay materiales registrados.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, idx) => (
                                                <TableRow key={dtoKey(item, idx)} hover>
                                                    <TableCell>
                                                        <Typography variant="caption" fontFamily="monospace">
                                                            {item.sku || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {item.description}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {item.quantity}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip label={item.unit} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.note}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Paper>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 4, py: 2 }}>
                <Button onClick={onClose} variant="contained" color="secondary">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}

const dtoKey = (item, idx) => item.id ? item.id : `item-${idx}`;
