// C:\SIRA\sira-front\src\components\G_OC\OcEditModal.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Autocomplete, Box, Typography, Divider, Alert,
  IconButton, Checkbox, FormControlLabel, Chip, Paper, Stepper, Step, StepLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-toastify';
import api from '../../api/api';
import FullScreenLoader from '../ui/FullScreenLoader';

/* ─── Helpers ─── */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round4 = (n) => Math.round((toNum(n) + Number.EPSILON) * 10000) / 10000;
const fmtMoney = (v, moneda = 'MXN') => {
  const n = toNum(v);
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${moneda}`;
};

const STEPS = ['Editar OC', 'Vista Previa'];

/* ─── Component ─── */
export default function OcEditModal({ open, oc, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Datos originales (snapshot para comparar en preview)
  const [originalData, setOriginalData] = useState(null);

  // Campos editables — cabecera
  const [motivo, setMotivo] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [monedas, setMonedas] = useState([]);
  const [monedaLoading, setMonedaLoading] = useState(false);
  const [comentariosFinanzas, setComentariosFinanzas] = useState('');
  const [impo, setImpo] = useState(false);
  const [ivaRate, setIvaRate] = useState('0.16');
  const [isrRate, setIsrRate] = useState('0');

  // Items
  const [items, setItems] = useState([]);

  // Proveedor autocomplete
  const [proveedorValue, setProveedorValue] = useState(null);
  const [proveedorInput, setProveedorInput] = useState('');
  const [proveedorOptions, setProveedorOptions] = useState([]);
  const [proveedorLoading, setProveedorLoading] = useState(false);
  const debouncedProvInput = useDebounce(proveedorInput, 400);

  // Agregar item — material autocomplete
  const [showAddRow, setShowAddRow] = useState(false);
  const [materialInput, setMaterialInput] = useState('');
  const [materialOptions, setMaterialOptions] = useState([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState(null);
  const [newCantidad, setNewCantidad] = useState('');
  const [newPrecio, setNewPrecio] = useState('');
  const [newPlazo, setNewPlazo] = useState('');
  const debouncedMatInput = useDebounce(materialInput, 400);

  // ─── Cargar datos OC ───
  useEffect(() => {
    if (!open || !oc?.id) return;

    setLoading(true);
    setMotivo('');
    setItems([]);
    setProveedorValue(null);
    setProveedorInput('');
    setActiveStep(0);
    setShowAddRow(false);
    setOriginalData(null);

    api.get(`/api/ocs/${oc.id}/editar-datos`)
      .then(data => {
        const curMoneda = data.items?.[0]?.moneda || 'MXN';
        setComentariosFinanzas(data.comentarios_finanzas || '');
        setMoneda(curMoneda);
        setImpo(data.impo === true);
        setIvaRate(String(data.iva_rate ?? 0.16));
        setIsrRate(String(data.isr_rate ?? 0));
        setItems(data.items.map(it => ({
          id: it.id,
          material_id: it.material_id,
          material_nombre: it.material_nombre,
          material_sku: it.material_sku || '',
          unidad_simbolo: it.unidad_simbolo,
          cantidad: String(it.cantidad),
          precio_unitario: String(it.precio_unitario),
          plazo_entrega: it.plazo_entrega || '',
          requisicion_detalle_id: it.requisicion_detalle_id,
          _isNew: false,
        })));
        // Pre-cargar proveedor
        const nombre = data.proveedor_nombre || '';
        setProveedorValue({ id: data.proveedor_id, nombre });
        setProveedorInput(nombre);
        setProveedorOptions([{ id: data.proveedor_id, nombre }]);

        // Guardar snapshot
        setOriginalData({
          proveedor_id: data.proveedor_id,
          proveedor_nombre: nombre,
          moneda: curMoneda,
          impo: data.impo === true,
          iva_rate: toNum(data.iva_rate ?? 0.16),
          isr_rate: toNum(data.isr_rate ?? 0),
          sub_total: toNum(data.sub_total),
          iva: toNum(data.iva),
          ret_isr: toNum(data.ret_isr),
          total: toNum(data.total),
          comentarios_finanzas: data.comentarios_finanzas || '',
          items: data.items.map(it => ({
            id: it.id,
            material_id: it.material_id,
            material_nombre: it.material_nombre,
            cantidad: toNum(it.cantidad),
            precio_unitario: toNum(it.precio_unitario),
            plazo_entrega: it.plazo_entrega || '',
          })),
        });
      })
      .catch(() => toast.error('No se pudieron cargar los datos de la OC.'))
      .finally(() => setLoading(false));
  }, [open, oc?.id]);

  // ─── Cargar monedas ───
  useEffect(() => {
    if (!open || monedas.length > 0) return;
    setMonedaLoading(true);
    api.get('/api/monedas')
      .then(data => setMonedas(data || []))
      .catch(() => { })
      .finally(() => setMonedaLoading(false));
  }, [open, monedas.length]);

  // ─── Buscar proveedores ───
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

  // ─── Buscar materiales (para agregar) ───
  useEffect(() => {
    if (debouncedMatInput.length < 2) return;
    setMaterialLoading(true);
    api.get(`/api/materiales?query=${encodeURIComponent(debouncedMatInput)}`)
      .then(data => setMaterialOptions(data || []))
      .catch(() => setMaterialOptions([]))
      .finally(() => setMaterialLoading(false));
  }, [debouncedMatInput]);

  // ─── Handlers ───
  const handleItemChange = useCallback((index, field, value) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }, []);

  const handleRemoveItem = useCallback((index) => {
    setItems(prev => {
      if (prev.length <= 1) {
        toast.warning('La OC debe tener al menos un item.');
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleAddItem = useCallback(() => {
    if (!newMaterial?.id) { toast.warning('Selecciona un material.'); return; }
    if (!newCantidad || toNum(newCantidad) <= 0) { toast.warning('Ingresa una cantidad válida.'); return; }
    if (!newPrecio || toNum(newPrecio) <= 0) { toast.warning('Ingresa un precio válido.'); return; }

    // Verificar que no esté duplicado
    const exists = items.some(it => it.material_id === newMaterial.id);
    if (exists) { toast.warning('Este material ya está en la OC.'); return; }

    setItems(prev => [...prev, {
      id: null, // null = nuevo
      material_id: newMaterial.id,
      material_nombre: newMaterial.nombre,
      material_sku: newMaterial.sku || '',
      unidad_simbolo: newMaterial.unidad_simbolo || '',
      cantidad: String(newCantidad),
      precio_unitario: String(newPrecio),
      plazo_entrega: newPlazo,
      requisicion_detalle_id: null,
      _isNew: true,
    }]);

    // Reset add row fields but keep it visible for adding more
    setNewMaterial(null);
    setNewCantidad('');
    setNewPrecio('');
    setNewPlazo('');
    setMaterialInput('');
    toast.success('Item agregado. Puedes agregar más.');
  }, [newMaterial, newCantidad, newPrecio, newPlazo, items]);

  // ─── Cálculos en vivo ───
  const calculated = useMemo(() => {
    const esImpo = impo === true;
    const ivR = toNum(ivaRate);
    const isR = toNum(isrRate);

    const subTotal = round4(
      items.reduce((s, it) => s + toNum(it.cantidad) * toNum(it.precio_unitario), 0)
    );
    const ivaCalc = (!esImpo && ivR > 0) ? round4(subTotal * ivR) : 0;
    const retIsrCalc = (!esImpo && isR > 0) ? round4(subTotal * isR) : 0;
    const total = round4(subTotal + ivaCalc - retIsrCalc);

    return { subTotal, iva: ivaCalc, retIsr: retIsrCalc, total };
  }, [items, impo, ivaRate, isrRate]);

  // ─── Preview data ───
  const previewChanges = useMemo(() => {
    if (!originalData) return null;

    const origItemMap = new Map(originalData.items.map(it => [it.id, it]));
    const currentIds = new Set(items.filter(it => it.id != null).map(it => it.id));

    const removed = originalData.items.filter(it => !currentIds.has(it.id));
    const added = items.filter(it => it._isNew || it.id == null);
    const modified = items.filter(it => {
      if (it.id == null) return false;
      const orig = origItemMap.get(it.id);
      if (!orig) return false;
      return toNum(it.cantidad) !== orig.cantidad ||
        toNum(it.precio_unitario) !== orig.precio_unitario ||
        (it.plazo_entrega || '') !== (orig.plazo_entrega || '');
    }).map(it => ({
      ...it,
      orig: origItemMap.get(it.id),
    }));

    const headerChanges = [];
    if (proveedorValue?.id !== originalData.proveedor_id) headerChanges.push('Proveedor');
    if (moneda !== originalData.moneda) headerChanges.push('Moneda');
    if (impo !== originalData.impo) headerChanges.push('Importación');
    if (toNum(ivaRate) !== originalData.iva_rate) headerChanges.push('Tasa IVA');
    if (toNum(isrRate) !== originalData.isr_rate) headerChanges.push('Tasa ISR');
    if (comentariosFinanzas !== originalData.comentarios_finanzas) headerChanges.push('Comentarios Finanzas');

    return { removed, added, modified, headerChanges };
  }, [originalData, items, proveedorValue, moneda, impo, ivaRate, isrRate, comentariosFinanzas]);

  // ─── PDF download ───
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

  // ─── Save ───
  const handleSave = async () => {
    if (!motivo.trim()) {
      toast.warning('El motivo de la modificación es obligatorio.');
      return;
    }

    const payload = {
      motivo: motivo.trim(),
      proveedor_id: proveedorValue?.id || null,
      comentarios_finanzas: comentariosFinanzas.trim() || null,
      impo,
      iva_rate: toNum(ivaRate),
      isr_rate: toNum(isrRate),
      items: items.map(it => ({
        id: it.id, // null for new items
        material_id: it.material_id,
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

  // ─── Navigation ───
  const goToPreview = () => {
    if (!motivo.trim()) {
      toast.warning('El motivo de la modificación es obligatorio.');
      return;
    }
    if (items.length === 0) {
      toast.warning('Debe haber al menos un item.');
      return;
    }
    setActiveStep(1);
  };

  if (!oc) return null;

  return (
    <>
      <FullScreenLoader isOpen={saving} message="Modificando Orden de Compra, por favor espera..." />
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Modificar OC: <strong>{oc.numero_oc || `OC-${oc.id}`}</strong>
          {originalData && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              {originalData.proyecto_nombre} • {originalData.sitio_nombre}
            </Typography>
          )}
        </DialogTitle>

        {/* Stepper */}
        <Box sx={{ px: 3, pt: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent dividers sx={{ minHeight: 400 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : activeStep === 0 ? (
            /* ═══════════════════ STEP 1: EDIT FORM ═══════════════════ */
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

              {/* Moneda + Impo row */}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Moneda</InputLabel>
                  <Select
                    value={moneda}
                    label="Moneda"
                    onChange={e => setMoneda(e.target.value)}
                    disabled={monedaLoading}
                    endAdornment={monedaLoading ? <CircularProgress size={18} sx={{ mr: 2 }} /> : null}
                  >
                    {monedas.length === 0 && <MenuItem value="MXN">MXN - Peso Mexicano</MenuItem>}
                    {monedas.map(m => (
                      <MenuItem key={m.codigo} value={m.codigo}>
                        {m.codigo} - {m.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={<Checkbox checked={impo} onChange={e => setImpo(e.target.checked)} size="small" />}
                  label="Es importación"
                />

                <TextField
                  label="Tasa IVA"
                  value={ivaRate}
                  onChange={e => setIvaRate(e.target.value)}
                  size="small"
                  type="number"
                  inputProps={{ min: 0, max: 1, step: '0.01' }}
                  sx={{ width: 110 }}
                  disabled={impo}
                />

                <TextField
                  label="Tasa ISR"
                  value={isrRate}
                  onChange={e => setIsrRate(e.target.value)}
                  size="small"
                  type="number"
                  inputProps={{ min: 0, max: 1, step: '0.01' }}
                  sx={{ width: 110 }}
                  disabled={impo}
                />
              </Box>

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

              {/* Items table */}
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Material</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Cantidad</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 130 }}>Precio Unit.</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Subtotal</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Plazo Entrega</TableCell>
                    <TableCell sx={{ width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id || `new-${idx}`} sx={item._isNew ? { bgcolor: '#e8f5e9' } : {}}>
                      <TableCell>
                        <Typography variant="body2">
                          {item.material_sku ? `${item.material_sku} - ` : ''}{item.material_nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{item.unidad_simbolo}</Typography>
                        {item._isNew && <Chip label="Nuevo" size="small" color="success" sx={{ ml: 1 }} />}
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.cantidad}
                          onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.precio_unitario}
                          onChange={e => handleItemChange(idx, 'precio_unitario', e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {fmtMoney(toNum(item.cantidad) * toNum(item.precio_unitario), moneda)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.plazo_entrega}
                          onChange={e => handleItemChange(idx, 'plazo_entrega', e.target.value)}
                          size="small"
                          placeholder="ej. 5 días"
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleRemoveItem(idx)}
                          color="error"
                          size="small"
                          disabled={items.length <= 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Add item row */}
                  {showAddRow && (
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TableCell>
                        <Autocomplete
                          value={newMaterial}
                          options={materialOptions}
                          getOptionLabel={opt => opt ? `${opt.sku} - ${opt.nombre}` : ''}
                          filterOptions={x => x}
                          loading={materialLoading}
                          isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                          onInputChange={(_, val) => setMaterialInput(val)}
                          onChange={(_, val) => {
                            setNewMaterial(val);
                          }}
                          renderInput={params => (
                            <TextField
                              {...params}
                              label="Buscar material"
                              size="small"
                              sx={{ minWidth: 200 }}
                            />
                          )}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={newCantidad}
                          onChange={e => setNewCantidad(e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 90 }}
                          placeholder="Cant."
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={newPrecio}
                          onChange={e => setNewPrecio(e.target.value)}
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          sx={{ width: 120 }}
                          placeholder="Precio"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(toNum(newCantidad) > 0 && toNum(newPrecio) > 0)
                            ? fmtMoney(toNum(newCantidad) * toNum(newPrecio), moneda)
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={newPlazo}
                          onChange={e => setNewPlazo(e.target.value)}
                          size="small"
                          placeholder="ej. 5 días"
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={handleAddItem} color="success" size="small">
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Add item button */}
              {!showAddRow && (
                <Button
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => setShowAddRow(true)}
                  variant="outlined"
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Agregar Item
                </Button>
              )}

              {/* Live totals summary */}
              <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Sub Total</Typography>
                    <Typography variant="h6">{fmtMoney(calculated.subTotal, moneda)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      IVA ({impo ? 'N/A' : `${(toNum(ivaRate) * 100).toFixed(0)}%`})
                    </Typography>
                    <Typography variant="h6">{impo ? '-' : fmtMoney(calculated.iva, moneda)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ret. ISR ({impo ? 'N/A' : `${(toNum(isrRate) * 100).toFixed(1)}%`})
                    </Typography>
                    <Typography variant="h6">{impo ? '-' : fmtMoney(calculated.retIsr, moneda)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a237e' }}>
                      {fmtMoney(calculated.total, moneda)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          ) : (
            /* ═══════════════════ STEP 2: PREVIEW ═══════════════════ */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              <Alert severity="info">
                Revisa los cambios antes de confirmar la modificación. Esta acción generará un nuevo PDF y enviará notificaciones.
              </Alert>

              {/* Motivo */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Motivo de la modificación</Typography>
                <Typography variant="body2">{motivo}</Typography>
              </Paper>

              {/* Header changes */}
              {previewChanges?.headerChanges?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Cambios en datos generales</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {previewChanges.headerChanges.map(c => (
                      <Chip key={c} label={c} color="warning" size="small" />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Removed items */}
              {previewChanges?.removed?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderColor: '#ef5350' }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Items eliminados ({previewChanges.removed.length})
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {previewChanges.removed.map(it => (
                        <TableRow key={it.id} sx={{ bgcolor: '#ffebee' }}>
                          <TableCell>{it.material_nombre}</TableCell>
                          <TableCell>Cant: {it.cantidad}</TableCell>
                          <TableCell>P.U: {fmtMoney(it.precio_unitario, originalData?.moneda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {/* Added items */}
              {previewChanges?.added?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderColor: '#66bb6a' }}>
                  <Typography variant="subtitle2" color="success.main" gutterBottom>
                    Items agregados ({previewChanges.added.length})
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {previewChanges.added.map((it, i) => (
                        <TableRow key={`add-${i}`} sx={{ bgcolor: '#e8f5e9' }}>
                          <TableCell>{it.material_nombre}</TableCell>
                          <TableCell>Cant: {it.cantidad}</TableCell>
                          <TableCell>P.U: {fmtMoney(it.precio_unitario, moneda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {/* Modified items */}
              {previewChanges?.modified?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderColor: '#ffa726' }}>
                  <Typography variant="subtitle2" color="warning.main" gutterBottom>
                    Items modificados ({previewChanges.modified.length})
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Material</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Campo</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Anterior</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Nuevo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewChanges.modified.map(it => {
                        const changes = [];
                        if (toNum(it.cantidad) !== it.orig.cantidad)
                          changes.push({ field: 'Cantidad', old: it.orig.cantidad, new: it.cantidad });
                        if (toNum(it.precio_unitario) !== it.orig.precio_unitario)
                          changes.push({ field: 'Precio Unit.', old: fmtMoney(it.orig.precio_unitario, originalData?.moneda), new: fmtMoney(it.precio_unitario, moneda) });
                        if ((it.plazo_entrega || '') !== (it.orig.plazo_entrega || ''))
                          changes.push({ field: 'Plazo', old: it.orig.plazo_entrega || '-', new: it.plazo_entrega || '-' });

                        return changes.map((ch, ci) => (
                          <TableRow key={`${it.id}-${ci}`} sx={{ bgcolor: '#fff3e0' }}>
                            {ci === 0 && (
                              <TableCell rowSpan={changes.length}>{it.material_nombre}</TableCell>
                            )}
                            <TableCell>{ch.field}</TableCell>
                            <TableCell sx={{ color: '#c62828', textDecoration: 'line-through' }}>{ch.old}</TableCell>
                            <TableCell sx={{ color: '#2e7d32', fontWeight: 'bold' }}>{ch.new}</TableCell>
                          </TableRow>
                        ));
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {/* No changes */}
              {previewChanges && previewChanges.removed.length === 0 && previewChanges.added.length === 0 && previewChanges.modified.length === 0 && previewChanges.headerChanges.length === 0 && (
                <Alert severity="warning">
                  No se detectaron cambios respecto a los valores originales. ¿Estás seguro de querer continuar?
                </Alert>
              )}

              {/* Totals comparison */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Comparación de totales</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Concepto</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Anterior</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Nuevo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Sub Total</TableCell>
                      <TableCell>{fmtMoney(originalData?.sub_total, originalData?.moneda)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{fmtMoney(calculated.subTotal, moneda)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>IVA</TableCell>
                      <TableCell>{fmtMoney(originalData?.iva, originalData?.moneda)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{fmtMoney(calculated.iva, moneda)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Ret. ISR</TableCell>
                      <TableCell>{fmtMoney(originalData?.ret_isr, originalData?.moneda)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{fmtMoney(calculated.retIsr, moneda)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#e8eaf6' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{fmtMoney(originalData?.total, originalData?.moneda)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '1.1em' }}>
                        {fmtMoney(calculated.total, moneda)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>

          {activeStep === 0 ? (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={goToPreview}
              disabled={saving || loading || !motivo.trim() || items.length === 0}
            >
              Vista Previa
            </Button>
          ) : (
            <>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => setActiveStep(0)}
                disabled={saving}
              >
                Volver a Editar
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving || loading}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
              >
                {saving ? 'Guardando...' : 'Confirmar Modificación'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
