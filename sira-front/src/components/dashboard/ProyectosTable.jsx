import React, { useState, useEffect } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Typography, Box, Select, MenuItem, Snackbar, Alert, Avatar,
    Stack, Tooltip, IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FolderIcon from '@mui/icons-material/Folder';
import FlagIcon from '@mui/icons-material/Flag';
import ForumIcon from '@mui/icons-material/Forum';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { PROYECTO_STATUS_COLOR } from './statusColors';
import useProyectoPreview from '../../hooks/useProyectoPreview';
import ProyectoInfoModal from '../common/ProyectoInfoModal';
import ProyectoHitosModal from './ProyectoHitosModal';
import ProyectoThreadsModal from './ProyectoThreadsModal';
import AgregarHitoModal from './AgregarHitoModal';

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
 * After the project name: two quick-action icons (threads & hitos).
 */
export default function ProyectosTable({ proyectos, statusOptions, onStatusChange }) {
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [updatingId, setUpdatingId] = useState(null);

    // Modal de detalle (existente)
    const [previewId, setPreviewId] = useState(null);

    // Modales nuevos
    const [hitosProyecto, setHitosProyecto] = useState(null);    // { id, nombre }
    const [threadsProyecto, setThreadsProyecto] = useState(null); // { id, nombre }
    const [agregarHitoProyecto, setAgregarHitoProyecto] = useState(null); // { id, nombre }

    // Data for the detail modal
    const { proyecto, hitos, gastos, loading: loadingPreview, error: errorPreview } = useProyectoPreview(previewId);

    // Cache of correctly-computed gasto_por_moneda keyed by project id.
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
                                    {/* Proyecto: avatar + nombre + 3 acciones — todo inline */}
                                    <TableCell sx={{ width: 265, maxWidth: 265, overflow: 'hidden' }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.75,
                                                overflow: 'hidden',
                                                // Grupo hover: los iconos se revelan suavemente
                                                '&:hover .proj-actions': {
                                                    opacity: 1,
                                                    transform: 'translateX(0)',
                                                },
                                            }}
                                        >
                                            {/* Avatar clickeable → detalle */}
                                            <Tooltip title="Ver detalle" placement="top">
                                                <Avatar
                                                    onClick={() => setPreviewId(p.id)}
                                                    sx={{
                                                        width: 28, height: 28,
                                                        fontSize: '0.72rem', fontWeight: 700,
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        flexShrink: 0,
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                                                        '&:hover': {
                                                            transform: 'scale(1.12)',
                                                            boxShadow: '0 0 0 3px rgba(99,102,241,0.25)',
                                                        },
                                                    }}
                                                >
                                                    {(p.nombre || '?')[0].toUpperCase()}
                                                </Avatar>
                                            </Tooltip>

                                            {/* Nombre + iconos — el nombre se encoge con ellipsis, iconos pegados a su derecha */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: '1 1 0', gap: 0.5 }}>
                                                <Tooltip title={p.nombre} placement="top" enterDelay={600}>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        noWrap
                                                        sx={{
                                                            flex: '0 1 auto',
                                                            minWidth: 0,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            cursor: 'default',
                                                            fontSize: '0.82rem',
                                                        }}
                                                    >
                                                        {p.nombre}
                                                    </Typography>
                                                </Tooltip>

                                            {/* Tres acciones — ocultas por defecto, revelar en hover */}
                                            <Stack
                                                className="proj-actions"
                                                direction="row"
                                                spacing={0.4}
                                                alignItems="center"
                                                sx={{
                                                    flexShrink: 0,
                                                    opacity: 0,
                                                    transform: 'translateX(4px)',
                                                    transition: 'opacity 0.2s cubic-bezier(0.4,0,0.2,1), transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                                                }}
                                            >
                                                {/* Threads */}
                                                <Tooltip title="Ver threads" placement="top">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setThreadsProyecto({ id: p.id, nombre: p.nombre });
                                                        }}
                                                        sx={{
                                                            p: 0.5,
                                                            borderRadius: 1.5,
                                                            color: '#8b5cf6',
                                                            bgcolor: alpha('#8b5cf6', 0.08),
                                                            border: '1px solid',
                                                            borderColor: alpha('#8b5cf6', 0.2),
                                                            transition: 'all 0.18s ease',
                                                            '&:hover': {
                                                                bgcolor: '#8b5cf6',
                                                                borderColor: '#8b5cf6',
                                                                color: '#fff',
                                                                boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
                                                                transform: 'translateY(-1px)',
                                                            },
                                                        }}
                                                    >
                                                        <ForumIcon sx={{ fontSize: 13 }} />
                                                    </IconButton>
                                                </Tooltip>

                                                {/* Hitos */}
                                                <Tooltip title="Ver hitos" placement="top">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHitosProyecto({ id: p.id, nombre: p.nombre });
                                                        }}
                                                        sx={{
                                                            p: 0.5,
                                                            borderRadius: 1.5,
                                                            color: '#f59e0b',
                                                            bgcolor: alpha('#f59e0b', 0.08),
                                                            border: '1px solid',
                                                            borderColor: alpha('#f59e0b', 0.2),
                                                            transition: 'all 0.18s ease',
                                                            '&:hover': {
                                                                bgcolor: '#f59e0b',
                                                                borderColor: '#f59e0b',
                                                                color: '#fff',
                                                                boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
                                                                transform: 'translateY(-1px)',
                                                            },
                                                        }}
                                                    >
                                                        <FlagIcon sx={{ fontSize: 13 }} />
                                                    </IconButton>
                                                </Tooltip>

                                                {/* Agregar hito */}
                                                <Tooltip title="Agregar hito" placement="top">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAgregarHitoProyecto({ id: p.id, nombre: p.nombre });
                                                        }}
                                                        sx={{
                                                            p: 0.5,
                                                            borderRadius: 1.5,
                                                            color: '#10b981',
                                                            bgcolor: alpha('#10b981', 0.08),
                                                            border: '1px solid',
                                                            borderColor: alpha('#10b981', 0.2),
                                                            transition: 'all 0.18s ease',
                                                            '&:hover': {
                                                                bgcolor: '#10b981',
                                                                borderColor: '#10b981',
                                                                color: '#fff',
                                                                boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
                                                                transform: 'translateY(-1px)',
                                                            },
                                                        }}
                                                    >
                                                        <AddCircleIcon sx={{ fontSize: 13 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                            </Box>{/* fin nombre+iconos */}
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

                                    {/* Gasto por moneda */}
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

            {/* Modal de detalle (existente) */}
            <ProyectoInfoModal
                open={!!previewId}
                onClose={() => setPreviewId(null)}
                proyecto={proyecto}
                hitos={hitos}
                gastos={gastos}
                loading={loadingPreview}
                error={errorPreview}
            />

            {/* Modal de hitos del proyecto */}
            <ProyectoHitosModal
                open={!!hitosProyecto}
                onClose={() => setHitosProyecto(null)}
                proyectoId={hitosProyecto?.id}
                proyectoNombre={hitosProyecto?.nombre}
            />

            {/* Modal de threads del proyecto */}
            <ProyectoThreadsModal
                open={!!threadsProyecto}
                onClose={() => setThreadsProyecto(null)}
                proyectoId={threadsProyecto?.id}
                proyectoNombre={threadsProyecto?.nombre}
            />

            {/* Modal agregar hito rápido */}
            <AgregarHitoModal
                open={!!agregarHitoProyecto}
                onClose={() => setAgregarHitoProyecto(null)}
                proyectoId={agregarHitoProyecto?.id}
                proyectoNombre={agregarHitoProyecto?.nombre}
                onSuccess={(hito) => {
                    setSnackbar({
                        open: true,
                        message: `Hito "${hito?.nombre || 'nuevo'}" agregado correctamente`,
                        severity: 'success',
                    });
                }}
            />
        </>
    );
}
