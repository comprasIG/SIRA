// sira-front/src/components/dashboard/incrementables/ModalCatalogos.jsx
/**
 * Modal para gestionar los catálogos del módulo Incrementables:
 *   - Tipos de Gasto Incrementable (tipo_incrementables)
 *   - Incoterms (catalogo_incoterms)
 *
 * Uso:
 *   <ModalCatalogos open={open} onClose={onClose} />
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Box, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, TextField, Switch,
  Typography, CircularProgress, Tooltip, Stack, Chip,
  Alert,
} from '@mui/material';
import EditIcon        from '@mui/icons-material/Edit';
import SaveIcon        from '@mui/icons-material/Save';
import CancelIcon      from '@mui/icons-material/Cancel';
import AddIcon         from '@mui/icons-material/Add';
import SettingsIcon    from '@mui/icons-material/Settings';
import { toast } from 'react-toastify';
import api from '../../../api/api';

/* ── helpers ── */
const emptyTipo      = { codigo: '', nombre: '', activo: true };
const emptyIncoterm  = { incoterm: '', abreviatura: '', activo: true };

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sub-componente: tabla editable genérica
 * ─────────────────────────────────────────────────────────────────────────────*/
function EditableTable({ rows, columns, onSave, onCreate, saving }) {
  const [editId,   setEditId]   = useState(null);
  const [editData, setEditData] = useState({});
  const [newRow,   setNewRow]   = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const startEdit = (row) => {
    setEditId(row.id);
    setEditData({ ...row });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditData({});
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave(editId, editData);
      setEditId(null);
      setEditData({});
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!newRow) return;
    setSubmitting(true);
    try {
      await onCreate(newRow);
      setNewRow(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, whiteSpace: 'nowrap', bgcolor: 'grey.50' } }}>
            {columns.map(c => <TableCell key={c.field}>{c.label}</TableCell>)}
            <TableCell align="center">Activo</TableCell>
            <TableCell align="center" sx={{ width: 80 }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => {
            const isEditing = editId === row.id;
            return (
              <TableRow key={row.id} hover>
                {columns.map(col => (
                  <TableCell key={col.field}>
                    {isEditing ? (
                      <TextField
                        size="small"
                        value={editData[col.field] ?? ''}
                        onChange={e => setEditData(p => ({ ...p, [col.field]: e.target.value }))}
                        inputProps={col.upper ? { style: { textTransform: 'uppercase' } } : {}}
                        sx={{ minWidth: col.minWidth || 120 }}
                      />
                    ) : (
                      <Typography variant="body2">{row[col.field]}</Typography>
                    )}
                  </TableCell>
                ))}

                {/* Activo */}
                <TableCell align="center">
                  {isEditing ? (
                    <Switch
                      checked={Boolean(editData.activo)}
                      onChange={e => setEditData(p => ({ ...p, activo: e.target.checked }))}
                      size="small"
                    />
                  ) : (
                    <Chip
                      label={row.activo ? 'Sí' : 'No'}
                      size="small"
                      color={row.activo ? 'success' : 'default'}
                    />
                  )}
                </TableCell>

                {/* Acciones */}
                <TableCell align="center">
                  {isEditing ? (
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Guardar">
                        <span>
                          <IconButton size="small" color="primary" onClick={handleSave} disabled={submitting}>
                            {submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Cancelar">
                        <IconButton size="small" onClick={cancelEdit} disabled={submitting}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => startEdit(row)} disabled={!!editId || !!newRow}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Fila "nuevo" */}
          {newRow ? (
            <TableRow sx={{ bgcolor: 'primary.50' }}>
              {columns.map(col => (
                <TableCell key={col.field}>
                  <TextField
                    size="small"
                    placeholder={col.label}
                    value={newRow[col.field] ?? ''}
                    onChange={e => setNewRow(p => ({ ...p, [col.field]: e.target.value }))}
                    inputProps={col.upper ? { style: { textTransform: 'uppercase' } } : {}}
                    sx={{ minWidth: col.minWidth || 120 }}
                  />
                </TableCell>
              ))}
              <TableCell align="center">
                <Switch
                  checked={Boolean(newRow.activo)}
                  onChange={e => setNewRow(p => ({ ...p, activo: e.target.checked }))}
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center">
                  <Tooltip title="Crear">
                    <span>
                      <IconButton size="small" color="primary" onClick={handleCreate} disabled={submitting}>
                        {submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancelar">
                    <IconButton size="small" onClick={() => setNewRow(null)} disabled={submitting}>
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length + 2} sx={{ border: 0, pt: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setNewRow({ ...columns.reduce((a, c) => ({ ...a, [c.field]: '' }), {}), activo: true })}
                  disabled={!!editId}
                  sx={{ textTransform: 'none' }}
                >
                  Agregar nuevo
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Modal principal
 * ─────────────────────────────────────────────────────────────────────────────*/
export default function ModalCatalogos({ open, onClose }) {
  const [tabActivo, setTabActivo] = useState(0);

  const [tipos,     setTipos]     = useState([]);
  const [incoterms, setIncoterms] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, i] = await Promise.all([
        api.get('/api/incrementables/catalogos/tipos'),
        api.get('/api/incrementables/catalogos/incoterms'),
      ]);
      setTipos(t);
      setIncoterms(i);
    } catch (err) {
      setError('No se pudieron cargar los catálogos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  /* ── Tipos ── */
  const guardarTipo = async (id, data) => {
    try {
      const updated = await api.put(`/api/incrementables/catalogos/tipos/${id}`, data);
      setTipos(prev => prev.map(t => t.id === id ? updated : t));
      toast.success('Tipo actualizado.');
    } catch (err) {
      toast.error(err?.error || 'Error al actualizar el tipo.');
      throw err;
    }
  };

  const crearTipo = async (data) => {
    try {
      const created = await api.post('/api/incrementables/catalogos/tipos', data);
      setTipos(prev => [...prev, created]);
      toast.success('Tipo creado.');
    } catch (err) {
      toast.error(err?.error || 'Error al crear el tipo.');
      throw err;
    }
  };

  /* ── Incoterms ── */
  const guardarIncoterm = async (id, data) => {
    try {
      const updated = await api.put(`/api/incrementables/catalogos/incoterms/${id}`, data);
      setIncoterms(prev => prev.map(i => i.id === id ? updated : i));
      toast.success('Incoterm actualizado.');
    } catch (err) {
      toast.error(err?.error || 'Error al actualizar el incoterm.');
      throw err;
    }
  };

  const crearIncoterm = async (data) => {
    try {
      const created = await api.post('/api/incrementables/catalogos/incoterms', data);
      setIncoterms(prev => [...prev, created]);
      toast.success('Incoterm creado.');
    } catch (err) {
      toast.error(err?.error || 'Error al crear el incoterm.');
      throw err;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <SettingsIcon color="primary" />
        Catálogos de Incrementables
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={tabActivo} onChange={(_, v) => setTabActivo(v)} sx={{ minHeight: 44 }}>
            <Tab label="Tipos de Gasto" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Incoterms" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        </Box>

        <Box sx={{ px: 2, py: 1, minHeight: 320 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" action={<Button size="small" onClick={cargar}>Reintentar</Button>}>
              {error}
            </Alert>
          ) : (
            <>
              <TabPanel value={tabActivo} index={0}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Tipos de costo incremental que se pueden crear (flete, impuestos, última milla, etc.)
                </Typography>
                <EditableTable
                  rows={tipos}
                  columns={[
                    { field: 'codigo', label: 'Código', upper: true, minWidth: 100 },
                    { field: 'nombre', label: 'Nombre', minWidth: 200 },
                  ]}
                  onSave={guardarTipo}
                  onCreate={crearTipo}
                />
              </TabPanel>

              <TabPanel value={tabActivo} index={1}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Catálogo de Incoterms 2020 (EXW, FOB, CIF, DDP, etc.)
                </Typography>
                <EditableTable
                  rows={incoterms}
                  columns={[
                    { field: 'abreviatura', label: 'Abreviatura', upper: true, minWidth: 100 },
                    { field: 'incoterm',    label: 'Descripción', minWidth: 240 },
                  ]}
                  onSave={guardarIncoterm}
                  onCreate={crearIncoterm}
                />
              </TabPanel>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
