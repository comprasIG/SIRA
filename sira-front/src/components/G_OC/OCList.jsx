
import React from 'react';
import {
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, Chip, Typography, Box
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; // Substitute
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HistoryIcon from '@mui/icons-material/History';


export default function OCList({ ocs, loading, onAction }) {

    const getStatusColor = (status) => {
        switch (status) {
            case 'ENTREGADA': return 'success';
            case 'CANCELADA': return 'error';
            case 'RECHAZADA': return 'error';
            case 'POR_AUTORIZAR': return 'warning';
            case 'ABIERTA': return 'info';
            default: return 'default';
        }
    };

    if (loading) {
        return <Typography sx={{ p: 4, textAlign: 'center' }}>Cargando órdenes de compra...</Typography>;
    }

    if (!ocs || ocs.length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="h6">No se encontraron órdenes de compra.</Typography>
            </Paper>
        );
    }

    return (
        <TableContainer component={Paper} elevation={1}>
            <Table sx={{ minWidth: 650 }} aria-label="lista de ordenes de compra">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Número OC</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Proyecto</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Proveedor</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Sitio</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Monto</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {ocs.map((oc) => (
                        <TableRow
                            key={oc.id}
                            sx={{ '&:hover': { bgcolor: '#f9fafb' } }}
                        >
                            <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                                {oc.numero_oc || oc.id}
                            </TableCell>
                            <TableCell>{oc.proyecto || '-'}</TableCell>
                            <TableCell>{oc.proveedor || '-'}</TableCell>
                            <TableCell>{oc.sitio || '-'}</TableCell>
                            <TableCell>{new Date(oc.fecha_creacion).toLocaleDateString()}</TableCell>
                            <TableCell>${Number(oc.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {oc.moneda}</TableCell>
                            <TableCell>
                                <Chip
                                    label={oc.status}
                                    color={getStatusColor(oc.status)}
                                    size="small"
                                    variant="outlined"
                                />
                            </TableCell>
                            <TableCell align="center">
                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                                    <Tooltip title="Ver Información">
                                        <IconButton size="small" onClick={() => onAction('info', oc)}>
                                            <InfoIcon fontSize="small" color="info" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Kardex / Trazabilidad">
                                        <IconButton size="small" onClick={() => onAction('kardex', oc)}>
                                            <HistoryIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Sustituir">
                                        <IconButton size="small" onClick={() => onAction('substitute', oc)}>
                                            <SwapHorizIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Modificar">
                                        <IconButton size="small" onClick={() => onAction('modify', oc)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Descargar PDF">
                                        <IconButton size="small" onClick={() => onAction('pdf', oc)}>
                                            <PictureAsPdfIcon fontSize="small" color="error" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Cancelar">
                                        <IconButton size="small" onClick={() => onAction('cancel', oc)}>
                                            <CancelIcon fontSize="small" color="error" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
