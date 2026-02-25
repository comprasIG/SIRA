// C:\SIRA\sira-front\src\components\dashboard\RequisicionEditModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Stack, Paper,
    Table, TableHead, TableRow, TableCell, TableBody,
    Checkbox, TextField, Autocomplete, CircularProgress, Chip, Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';
import api from '../../api/api';
import { toast } from 'react-toastify';

/**
 * Modal de edición restringida de una requisición (solo Compras/SSD).
 * Permite:
 *  - Quitar partidas (deseleccionando el checkbox) — SOLO si no tienen OC activa
 *  - Modificar la cantidad solicitada — SOLO si no tienen OC activa
 *  - Cambiar sitio y proyecto destino
 *
 * Materiales con OC activa (status <> 'CANCELADA') aparecen bloqueados (🔒).
 */
export default function RequisicionEditModal({ open, onClose, rfqData, onSaved }) {
    const theme = useTheme();

    // Sitios y proyectos para los selectores
    const [sitios, setSitios] = useState([]);
    const [proyectos, setProyectos] = useState([]);

    // Campos editables
    const [selectedSitio, setSelectedSitio] = useState(null);
    const [selectedProyecto, setSelectedProyecto] = useState(null);
    const [materiales, setMateriales] = useState([]); // { ...mat, checked: true, cantidad: N, locked: bool }

    // Material IDs protegidos por OC activa
    const [protegidos, setProtegidos] = useState(new Set());

    const [saving, setSaving] = useState(false);

    // Cargar catálogos
    useEffect(() => {
        if (!open) return;
        api.get('/api/sitios').then(setSitios).catch(() => toast.error('Error al cargar sitios'));
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const sitioId = selectedSitio?.id;
        if (!sitioId) {
            api.get('/api/proyectos').then(setProyectos).catch(() => toast.error('Error al cargar proyectos'));
            return;
        }
        api.get('/api/proyectos', { params: { sitio_id: sitioId } })
            .then(setProyectos)
            .catch(() => {
                api.get('/api/proyectos').then(all => {
                    setProyectos(all.filter(p => p.sitio_id === sitioId));
                }).catch(() => toast.error('Error al cargar proyectos'));
            });
    }, [open, selectedSitio]);

    // Cargar protección OC al abrir
    useEffect(() => {
        if (!open || !rfqData?.id) return;
        api.get(`/api/requisiciones/${rfqData.id}/proteccion-oc`)
            .then(data => {
                setProtegidos(new Set((data.material_ids_protegidos || []).map(Number)));
            })
            .catch(() => {
                console.warn('No se pudo cargar protección OC');
                setProtegidos(new Set());
            });
    }, [open, rfqData?.id]);

    // Inicializar estado con datos de la requisición al abrir
    useEffect(() => {
        if (!open || !rfqData) return;

        // Sitio
        if (rfqData.sitio_id && rfqData.sitio) {
            setSelectedSitio({ id: rfqData.sitio_id, nombre: rfqData.sitio });
        } else {
            setSelectedSitio(null);
        }

        // Proyecto
        if (rfqData.proyecto_id && rfqData.proyecto) {
            setSelectedProyecto({ id: rfqData.proyecto_id, nombre: rfqData.proyecto });
        } else {
            setSelectedProyecto(null);
        }

        // Materiales con checkbox
        if (rfqData.materiales) {
            setMateriales(rfqData.materiales.map(mat => ({
                ...mat,
                checked: true,
                cantidadEdit: Number(mat.cantidad),
            })));
        }
    }, [open, rfqData]);

    // Determinar si un material está bloqueado
    const isLocked = (mat) => protegidos.has(Number(mat.material_id));

    const handleCheckToggle = (idx) => {
        const mat = materiales[idx];
        if (isLocked(mat)) return; // No se puede desmarcar
        setMateriales(prev => prev.map((m, i) => i === idx ? { ...m, checked: !m.checked } : m));
    };

    const handleCantidadChange = (idx, value) => {
        const mat = materiales[idx];
        if (isLocked(mat)) return; // No se puede modificar
        const num = Number(value);
        if (value === '' || (num >= 0)) {
            setMateriales(prev => prev.map((m, i) => i === idx ? { ...m, cantidadEdit: value === '' ? '' : num } : m));
        }
    };

    const checkedCount = materiales.filter(m => m.checked).length;

    const handleSave = async () => {
        if (checkedCount === 0) {
            return toast.warning('Debes mantener al menos una partida.');
        }
        if (!selectedSitio || !selectedProyecto) {
            return toast.warning('Debes seleccionar sitio y proyecto.');
        }

        const materialesPayload = materiales
            .filter(m => m.checked)
            .map(m => ({
                material_id: m.material_id,
                cantidad: m.cantidadEdit || m.cantidad,
                comentario: m.comentario || null,
            }));

        // Validar cantidades > 0
        const invalid = materialesPayload.find(m => !m.cantidad || Number(m.cantidad) <= 0);
        if (invalid) {
            return toast.warning('Todas las cantidades deben ser mayores a 0.');
        }

        setSaving(true);
        try {
            await api.patch(`/api/requisiciones/${rfqData.id}/editar-compras`, {
                sitio_id: selectedSitio.id,
                proyecto_id: selectedProyecto.id,
                materiales: materialesPayload,
            });
            toast.success('Requisición actualizada correctamente.');
            if (onSaved) onSaved();
            onClose();
        } catch (err) {
            toast.error(err?.error || 'Error al guardar cambios.');
        } finally {
            setSaving(false);
        }
    };

    if (!rfqData) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle
                sx={{
                    px: 4, py: 3,
                    backgroundImage: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(t.palette.primary.main, 0.02)} 100%)`,
                    borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                        <Typography variant="overline" sx={{ letterSpacing: 1.4 }} color="primary">
                            Editar Requisición
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="text.primary">
                            {rfqData.numero_requisicion || rfqData.rfq_code || '—'}
                        </Typography>
                    </Box>
                    <EditIcon color="primary" sx={{ fontSize: 32, opacity: 0.6 }} />
                </Stack>
            </DialogTitle>

            <DialogContent dividers sx={{ px: 4, py: 3.5, backgroundColor: '#f9fafb' }}>
                <Stack spacing={3}>
                    {/* Leyenda de protección */}
                    {protegidos.size > 0 && (
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 1.5, borderRadius: 2,
                                backgroundColor: alpha(theme.palette.warning.main, 0.06),
                                borderColor: alpha(theme.palette.warning.main, 0.3),
                                display: 'flex', alignItems: 'center', gap: 1,
                            }}
                        >
                            <LockIcon fontSize="small" color="warning" />
                            <Typography variant="caption" color="text.secondary">
                                Las partidas marcadas con <strong>🔒</strong> tienen OC activa y no pueden ser eliminadas ni modificadas.
                            </Typography>
                        </Paper>
                    )}

                    {/* Sitio y Proyecto */}
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, backgroundColor: 'white' }}>
                        <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>
                            Destino
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Autocomplete
                                fullWidth
                                options={sitios}
                                getOptionLabel={(o) => o.nombre || ''}
                                value={selectedSitio}
                                onChange={(_, v) => {
                                    setSelectedSitio(v);
                                    setSelectedProyecto(null);
                                }}
                                isOptionEqualToValue={(o, v) => o.id === v?.id}
                                renderInput={(params) => <TextField {...params} label="Sitio" size="small" />}
                            />
                            <Autocomplete
                                fullWidth
                                options={proyectos}
                                getOptionLabel={(o) => o.nombre || ''}
                                value={selectedProyecto}
                                onChange={(_, v) => setSelectedProyecto(v)}
                                isOptionEqualToValue={(o, v) => o.id === v?.id}
                                renderInput={(params) => <TextField {...params} label="Proyecto" size="small" />}
                            />
                        </Stack>
                    </Paper>

                    {/* Partidas */}
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box
                            sx={{
                                px: 3, py: 1.5,
                                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                Partidas ({checkedCount} de {materiales.length} seleccionadas)
                            </Typography>
                            {protegidos.size > 0 && (
                                <Chip
                                    icon={<LockIcon sx={{ fontSize: 14 }} />}
                                    label={`${protegidos.size} con OC activa`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                />
                            )}
                        </Box>
                        <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox"></TableCell>
                                        <TableCell>SKU</TableCell>
                                        <TableCell>Material</TableCell>
                                        <TableCell align="right">Cantidad Original</TableCell>
                                        <TableCell align="right" sx={{ minWidth: 130 }}>Nueva Cantidad</TableCell>
                                        <TableCell>Unidad</TableCell>
                                        <TableCell align="center" sx={{ width: 40 }}></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {materiales.map((mat, idx) => {
                                        const locked = isLocked(mat);
                                        return (
                                            <TableRow
                                                key={mat.material_id || idx}
                                                hover
                                                sx={{
                                                    opacity: mat.checked ? 1 : 0.4,
                                                    transition: 'opacity 0.2s',
                                                    backgroundColor: locked ? alpha(theme.palette.warning.main, 0.04) : 'inherit',
                                                }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Tooltip title={locked ? 'Tiene OC activa — no se puede quitar' : ''}>
                                                        <span>
                                                            <Checkbox
                                                                checked={mat.checked}
                                                                onChange={() => handleCheckToggle(idx)}
                                                                color="primary"
                                                                disabled={locked}
                                                            />
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" fontFamily="monospace">
                                                        {mat.sku || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {mat.material || mat.descripcion || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        label={Number(mat.cantidad).toFixed(2)}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontFamily: 'monospace' }}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title={locked ? 'Tiene OC activa — cantidad no modificable' : ''}>
                                                        <span>
                                                            <TextField
                                                                type="number"
                                                                size="small"
                                                                value={mat.cantidadEdit}
                                                                onChange={(e) => handleCantidadChange(idx, e.target.value)}
                                                                disabled={!mat.checked || locked}
                                                                inputProps={{ min: 0.01, step: 0.01 }}
                                                                sx={{ width: 110 }}
                                                            />
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={mat.unidad || '-'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                </TableCell>
                                                <TableCell align="center">
                                                    {locked && (
                                                        <Tooltip title="Partida protegida: tiene OC activa">
                                                            <LockIcon fontSize="small" color="warning" />
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Box>
                    </Paper>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 4, py: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || checkedCount === 0}
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
