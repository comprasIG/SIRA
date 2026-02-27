import React, { useState, useEffect } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Typography, Box, Select, MenuItem, Snackbar, Alert, Avatar,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { PROYECTO_STATUS_COLOR } from './statusColors';
import useProyectoPreview from '../../hooks/useProyectoPreview';
import ProyectoInfoModal from '../common/ProyectoInfoModal';

/**
 * Formats a number as currency with thousands separators.
 */
function fmtMoney(val) {
    if (val == null) return '—';
    return Number(val).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/* Row hover style */
const rowHoverSx = {
    transition: 'background-color 0.2s ease',
    '&:hover': {
        backgroundColor: 'rgba(99, 102, 241, 0.04)',
    },
};

/* Header cell style */
const headerCellSx = {
    fontWeight: 700,
    fontSize: '0.72rem',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: 'text.secondary',
    borderBottom: '2px solid',
    borderBottomColor: 'divider',
    py: 1.5,
    whiteSpace: 'nowrap',
};

/**
 * Table for projects with inline status dropdown, department, responsable,
 * cliente, dates, and spending by currency.
 */
export default function ProyectosTable({ proyectos, statusOptions, onStatusChange }) {
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [updatingId, setUpdatingId] = useState(null);
    const [previewId, setPreviewId] = useState(null);

    // Data for the modal
    const { proyecto, hitos, gastos, loading: loadingPreview, error: errorPreview } = useProyectoPreview(previewId);

    // Cache of correctly-computed gasto_por_moneda keyed by project id.
    // The backend list endpoint sometimes returns wrong pre-aggregated values;
    // we recalculate from the individual OC records each time a project detail loads.
    const [gastosCache, setGastosCache] = useState({});
    useEffect(() => {
        if (!previewId || loadingPreview || !gastos) return;
        const totals = gastos.reduce((acc, g) => {
            const moneda = g.moneda || 'MXN';
            acc[moneda] = (acc[moneda] || 0) + (Number(g.total) || 0);
            return acc;
        }, {});
        const computed = Object.entries(totals).map(([moneda, total]) => ({ moneda, total }));
        setGastosCache((prev) => ({ ...prev, [previewId]: computed }));
    }, [previewId, gastos, loadingPreview]);

    const handleStatusChange = async (id, newStatus) => {
        setUpdatingId(id);
        try {
            await onStatusChange(id, newStatus);
            setSnackbar({ open: true, message: `Status actualizado a '${newStatus.replace(/_/g, ' ')}'`, severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: err?.error || 'Error al actualizar status', severity: 'error' });
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <>
            <TableContainer>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={headerCellSx}>Proyecto</TableCell>
                            <TableCell sx={headerCellSx}>Sitio</TableCell>
                            <TableCell sx={headerCellSx}>Cliente</TableCell>
                            <TableCell sx={headerCellSx}>Responsable</TableCell>
                            <TableCell sx={headerCellSx}>Depto</TableCell>
                            <TableCell sx={headerCellSx}>Status</TableCell>
                            <TableCell sx={headerCellSx}>Inicio</TableCell>
                            <TableCell sx={headerCellSx}>Cierre</TableCell>
                            <TableCell sx={headerCellSx}>Gasto por Moneda</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(proyectos || []).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                        <FolderIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                        <Typography variant="body2" color="text.secondary">
                                            No se encontraron proyectos.
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            (proyectos || []).map((p) => (
                                <TableRow key={p.id} sx={rowHoverSx}>
                                    {/* Proyecto name with avatar - Clickable */}
                                    <TableCell>
                                        <Box
                                            onClick={() => setPreviewId(p.id)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                cursor: 'pointer',
                                                p: 0.5,
                                                borderRadius: 1,
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    bgcolor: 'rgba(255, 255, 255, 0.5)',
                                                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)', // Luminous effect
                                                    '& .view-details': { opacity: 1, maxHeight: 20 }
                                                }
                                            }}
                                        >
                                            <Avatar
                                                sx={{
                                                    width: 30,
                                                    height: 30,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                }}
                                            >
                                                {(p.nombre || '?')[0].toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.nombre}
                                                </Typography>
                                                <Typography
                                                    className="view-details"
                                                    variant="caption"
                                                    color="primary"
                                                    sx={{
                                                        fontWeight: 600,
                                                        opacity: 0,
                                                        maxHeight: 0,
                                                        transition: 'all 0.2s',
                                                        display: 'block'
                                                    }}
                                                >
                                                    Ver detalle
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>

                                    {/* Sitio */}
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{p.sitio_nombre || '—'}</Typography>
                                    </TableCell>

                                    {/* Cliente */}
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{p.cliente_nombre || '—'}</Typography>
                                    </TableCell>

                                    {/* Responsable */}
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{p.responsable_nombre || '—'}</Typography>
                                    </TableCell>

                                    {/* Department */}
                                    <TableCell>
                                        {p.departamento_nombre ? (
                                            <Chip
                                                label={p.departamento_nombre}
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                    fontWeight: 500,
                                                    fontSize: '0.7rem',
                                                    borderRadius: 2,
                                                    borderColor: 'primary.light',
                                                    color: 'primary.dark',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.06)',
                                                }}
                                            />
                                        ) : (
                                            <Typography variant="caption" color="text.disabled">—</Typography>
                                        )}
                                    </TableCell>

                                    {/* Status dropdown */}
                                    <TableCell>
                                        <Select
                                            size="small"
                                            value={p.status}
                                            onChange={(e) => handleStatusChange(p.id, e.target.value)}
                                            disabled={updatingId === p.id}
                                            variant="standard"
                                            disableUnderline
                                            IconComponent={(props) => (
                                                <span {...props} style={{ ...props.style, fontSize: 14, color: '#999', marginLeft: -4 }}>▾</span>
                                            )}
                                            renderValue={(value) => (
                                                <Chip
                                                    label={value.replace(/_/g, ' ')}
                                                    color={PROYECTO_STATUS_COLOR[value] || 'default'}
                                                    size="small"
                                                    sx={{ fontWeight: 'bold', cursor: 'pointer', borderRadius: 2, fontSize: '0.7rem' }}
                                                />
                                            )}
                                            sx={{
                                                '& .MuiSelect-select': {
                                                    p: '0 !important',
                                                    pr: '16px !important',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                },
                                                '& .MuiInput-input:focus': { backgroundColor: 'transparent' },
                                            }}
                                        >
                                            {(statusOptions || []).map((s) => (
                                                <MenuItem key={s} value={s}>
                                                    <Chip
                                                        label={s.replace(/_/g, ' ')}
                                                        color={PROYECTO_STATUS_COLOR[s] || 'default'}
                                                        size="small"
                                                        sx={{ fontWeight: 'bold', pointerEvents: 'none', borderRadius: 2 }}
                                                    />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </TableCell>

                                    {/* Dates */}
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                            {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-MX') : '—'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                            {p.fecha_cierre ? new Date(p.fecha_cierre).toLocaleDateString('es-MX') : '—'}
                                        </Typography>
                                    </TableCell>

                                    {/* Spending by currency
                                        Priority: cached value computed from individual OCs (correct)
                                        Fallback: pre-aggregated value from list endpoint (may be wrong) */}
                                    <TableCell>
                                        {(() => {
                                            const gastoPorMoneda = gastosCache[p.id] !== undefined
                                                ? gastosCache[p.id]
                                                : (p.gasto_por_moneda || []);
                                            return gastoPorMoneda.length > 0 ? (
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {gastoPorMoneda.map((g) => (
                                                        <Chip
                                                            key={g.moneda}
                                                            label={`${g.moneda} $${fmtMoney(g.total)}`}
                                                            size="small"
                                                            sx={{
                                                                fontWeight: 600,
                                                                fontSize: '0.72rem',
                                                                fontFamily: 'monospace',
                                                                borderRadius: 2,
                                                                backgroundColor: 'rgba(67, 233, 123, 0.1)',
                                                                color: '#1a6b3c',
                                                                border: '1px solid rgba(67, 233, 123, 0.3)',
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                                    Sin gasto
                                                </Typography>
                                            );
                                        })()}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ borderRadius: 2 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Modal for project details */}
            <ProyectoInfoModal
                open={!!previewId}
                onClose={() => setPreviewId(null)}
                proyecto={proyecto}
                hitos={hitos}
                gastos={gastos}
                loading={loadingPreview}
                error={errorPreview}
            />
        </>
    );
}
