// C:\SIRA\sira-front\src\components\G_OC\OcEditModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Autocomplete, Box, Typography, Divider, Alert,
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../api/api';
import FullScreenLoader from '../ui/FullScreenLoader';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

export default function OcEditModal({ open, oc, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos editables
  const [motivo, setMotivo] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [monedas, setMonedas] = useState([]);
  const [monedaLoading, setMonedaLoading] = useState(false);
  const [comentariosFinanzas, setComentariosFinanzas] = useState('');
  const [items, setItems] = useState([]);

  // Proveedor autocomplete
  const [proveedorValue, setProveedorValue] = useState(null);
  const [proveedorInput, setProveedorInput] = useState('');
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [proveedorLoading, setProveedorLoading] = useState(false);
  const debouncedProvInput = useDebounce(proveedorInput, 400);

  // Cargar datos de la OC cuando el modal se abre
  useEffect(() => {
    if (!open || !oc?.id) return;

    setLoading(true);
    setMotivo('');
    setItems([]);
    setProveedorValue(null);
    setProveedorInput('');

    api.get(`/api/ocs/${oc.id}/editar-datos`)
      .then(data => {
        setComentariosFinanzas(data.comentarios_finanzas || '');
        setMoneda(data.items?.[0]?.moneda || 'MXN');
        setItems(data.items.map(it => ({
          id: it.id,
          material_nombre: it.material_nombre,
          unidad_simbolo: it.unidad_simbolo,
          cantidad: String(it.cantidad),
          precio_unitario: String(it.precio_unitario),
          plazo_entrega: it.plazo_entrega || '',
        })));
        // Pre-cargar proveedor
        const nombre = data.proveedor_nombre || '';
        setProveedorValue({ id: data.proveedor_id, nombre });
        setProveedorInput(nombre);
        setProveedorOptions([{ id: data.proveedor_id, nombre }]);
      })
      .catch(() => toast.error('No se pudieron cargar los datos de la OC.'))
      .finally(() => setLoading(false));
  }, [open, oc?.id]);

  // Cargar monedas cuando se abre el modal
  useEffect(() => {
    if (!open || monedas.length > 0) return;
    setMonedaLoading(true);
    api.get('/api/monedas')
      .then(data => setMonedas(data || []))
      .catch(() => { })
      .finally(() => setMonedaLoading(false));
  }, [open, monedas.length]);

  // Buscar proveedores con debounce
  useEffect(() => {
    if (debouncedProvInput.length < 2) return;
    setProveedorLoading(true);
    api.get(`/api/proveedores?query=${encodeURIComponent(debouncedProvInput)}`)
      .then(data => {
        const list = (data?.proveedores || data || []).map(p => ({
          id: p.id,
          nombre: p.razon_social || p.nombre || p.marca || '',
        }));
        setProveedorOptions(list);
      })
      .catch(() => { })
      .finally(() => setProveedorLoading(false));
  }, [debouncedProvInput]);

  // Editar campo de un item
  const handleItemChange = useCallback((index, field, value) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }, []);

  // Descarga del PDF tras guardar
  const downloadPdf = useCallback(async (ocId, numeroOc) => {
    try {
      const resp = await api.get(`/api/ocs/${ocId}/pdf`, { responseType: 'blob' });
      const blob = resp.data;
      const cd = resp.headers?.get?.('content-disposition') ?? '';
      const match = cd.match(/filename="(.+?)"/i);
      const filename = match?.[1] || `${numeroOc}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('OC guardada, pero no se pudo descargar el PDF.');
    }
  }, []);

  const handleSave = async () => {
    if (!motivo.trim()) {
      toast.warning('El motivo de la modificación es obligatorio.');
      return;
    }

    const payload = {
      motivo: motivo.trim(),
      proveedor_id: proveedorValue?.id || null,
      comentarios_finanzas: comentariosFinanzas.trim() || null,
      items: items.map(it => ({
        id: it.id,
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        moneda,
        plazo_entrega: it.plazo_entrega || null,
      })),
    };

    setSaving(true);
    try {
      const result = await api.patch(`/api/ocs/${oc.id}/editar`, payload);
      toast.success(result?.mensaje || 'OC modificada correctamente.');
      await downloadPdf(oc.id, oc.numero_oc || `OC-${oc.id}`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.error || err?.message || 'Error al modificar la OC.');
    } finally {
      setSaving(false);
    }
  };

  if (!oc) return null;

  return (
    <>
      <FullScreenLoader isOpen={saving} message="Modificando Orden de Compra, por favor espera..." />
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Modificar OC: <strong>{oc.numero_oc || `OC-${oc.id}`}</strong>
        </DialogTitle>

        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Motivo */}
              <TextField
                label="Motivo de la modificación *"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                error={!motivo.trim() && motivo !== ''}
                helperText="Requerido. Se incluirá en el correo de notificación."
                autoFocus
              />

              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary">Datos generales</Typography>
              </Divider>

              {/* Proveedor */}
              <Autocomplete
                value={proveedorValue}
                inputValue={proveedorInput}
                options={proveedorOptions}
                getOptionLabel={opt => opt?.nombre || ''}
                isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                loading={proveedorLoading}
                filterOptions={x => x}
                onInputChange={(_, val) => setProveedorInput(val)}
                onChange={(_, val) => setProveedorValue(val)}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Proveedor"
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {proveedorLoading && <CircularProgress size={18} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              {/* Moneda */}
              <FormControl size="small" sx={{ maxWidth: 280 }}>
                <InputLabel>Moneda (aplica a todos los items)</InputLabel>
                <Select
                  value={moneda}
                  label="Moneda (aplica a todos los items)"
                  onChange={e => setMoneda(e.target.value)}
                  disabled={monedaLoading}
                  endAdornment={monedaLoading ? <CircularProgress size={18} sx={{ mr: 2 }} /> : null}
                >
                  {monedas.length === 0 && (
                    <MenuItem value="MXN">MXN - Peso Mexicano</MenuItem>
                  )}
                  {monedas.map(m => (
                    <MenuItem key={m.codigo} value={m.codigo}>
                      {m.codigo} - {m.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Comentarios Finanzas */}
              <TextField
                label="Comentarios para Finanzas"
                value={comentariosFinanzas}
                onChange={e => setComentariosFinanzas(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                size="small"
              />

              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary">Líneas de la OC</Typography>
              </Divider>

              {/* Tabla de items */}
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Material</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 110 }}>Cantidad</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Precio Unit.</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 160 }}>Plazo Entrega</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2">{item.material_nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.unidad_simbolo}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.cantidad}
                          onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.precio_unitario}
                          onChange={e => handleItemChange(idx, 'precio_unitario', e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.plazo_entrega}
                          onChange={e => handleItemChange(idx, 'plazo_entrega', e.target.value)}
                          size="small"
                          placeholder="ej. 5 días"
                          sx={{ width: 150 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Alert severity="info" sx={{ mt: 1 }}>
                Los totales (subtotal, IVA, ISR) se recalcularán automáticamente usando las tasas actuales de la OC.
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || loading || !motivo.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
