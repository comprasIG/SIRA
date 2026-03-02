// sira-front/src/components/dashboard/incrementables/ModalCrearIncrementable.jsx
/**
 * Modal de 3 pasos para crear una OC Incrementable de Importación.
 *
 * Step 1 — Tipo y Costo
 * Step 2 — OC Base a afectar (multi-select) + Tipos de cambio si hay mezcla de monedas
 * Step 3 — Preview de distribución proporcional + Confirmar
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stepper, Step, StepLabel,
  Typography, Button, IconButton, Divider,
  TextField, Select, MenuItem, FormControl, InputLabel,
  FormControlLabel, Switch, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Stack, Alert, Paper, Checkbox, Tooltip,
  Autocomplete,
} from '@mui/material';
import CloseIcon    from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { useIncrementables } from '../../../hooks/useIncrementables';

const STEPS = ['Tipo y Costo', 'OC Base', 'Distribución y Confirmar'];

const fmtMonto = (n, moneda = 'MXN') =>
  `${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}`;

const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

// Monedas comunes para sugerir TC
const MONEDAS_COMUNES = ['MXN', 'USD', 'EUR', 'GBP', 'CNY'];

export default function ModalCrearIncrementable({ open, onClose, datosIniciales, loadingIniciales, onCreated }) {
  const { previewDistribucion, crearIncrementable, isSubmitting } = useIncrementables();

  const [activeStep, setActiveStep] = useState(0);

  // ─── Step 1: Tipo y costo ──────────────────────────────────────────────────
  const [tipoId,     setTipoId]     = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [montoTotal,  setMontoTotal]  = useState('');
  const [moneda,      setMoneda]      = useState('USD');
  const [esUrgente,   setEsUrgente]   = useState(false);
  const [comentario,  setComentario]  = useState('');

  // ─── Step 2: OC Base ───────────────────────────────────────────────────────
  const [ocBaseSeleccionadas, setOcBaseSeleccionadas] = useState([]);
  const [tipoCambios, setTipoCambios] = useState({ MXN: 1, USD: '', EUR: '' });

  // ─── Step 3: Distribución preview ─────────────────────────────────────────
  const [distribucion,    setDistribucion]    = useState([]);
  const [loadingPreview,  setLoadingPreview]  = useState(false);

  const tipos       = datosIniciales?.tipos       || [];
  const ocsImpo     = datosIniciales?.ocs_impo    || [];
  const proveedores = datosIniciales?.proveedores || [];
  const monedas     = datosIniciales?.monedas     || [];

  // ─── Monedas involucradas (de las OC base seleccionadas) ──────────────────
  const monedasOcBase = useMemo(() => {
    const set = new Set();
    ocBaseSeleccionadas.forEach(id => {
      const oc = ocsImpo.find(o => o.id === id);
      if (oc?.moneda) set.add(oc.moneda);
    });
    return [...set];
  }, [ocBaseSeleccionadas, ocsImpo]);

  // Monedas que necesitan TC (distintas de MXN y de la moneda del incrementable)
  const monedasQueNecesitanTc = useMemo(() => {
    const needed = new Set(monedasOcBase);
    needed.add(moneda); // la moneda del incrementable también puede necesitar TC respecto a MXN
    needed.delete('MXN');
    return [...needed];
  }, [monedasOcBase, moneda]);

  // Inicializar TC con 1 para MXN si no está
  useEffect(() => {
    setTipoCambios(prev => ({ ...prev, MXN: 1 }));
  }, []);

  // ─── Validaciones por step ─────────────────────────────────────────────────
  const step1Valid = tipoId && proveedorId && montoTotal > 0 && moneda;
  const step2Valid = ocBaseSeleccionadas.length > 0;

  // ─── Navegación ────────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (activeStep === 1) {
      // Cargar preview antes de ir al step 3
      await cargarPreview();
    }
    setActiveStep(s => s + 1);
  };

  const handleBack = () => setActiveStep(s => s - 1);

  // ─── Calcular preview ─────────────────────────────────────────────────────
  const cargarPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      // Asegurar MXN: 1 en TCs
      const tcs = { ...tipoCambios, MXN: 1 };
      // Para monedas sin TC ingresado, usar 1 como fallback
      monedasQueNecesitanTc.forEach(m => {
        if (!tcs[m] || tcs[m] === '') tcs[m] = 1;
      });

      const result = await previewDistribucion({
        oc_base_ids: ocBaseSeleccionadas,
        tipo_cambios: tcs,
        monto_total: Number(montoTotal),
        moneda_incrementable: moneda,
      });
      setDistribucion(result || []);
    } catch (e) {
      setDistribucion([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [ocBaseSeleccionadas, tipoCambios, montoTotal, moneda, previewDistribucion, monedasQueNecesitanTc]);

  // ─── Confirmar y crear ─────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    try {
      const tcs = { ...tipoCambios, MXN: 1 };
      monedasQueNecesitanTc.forEach(m => {
        if (!tcs[m] || tcs[m] === '') tcs[m] = 1;
      });

      await crearIncrementable({
        tipo_incrementable_id: Number(tipoId),
        proveedor_id: Number(proveedorId),
        monto_total: Number(montoTotal),
        moneda,
        oc_base_ids: ocBaseSeleccionadas,
        tipo_cambios: tcs,
        comentario: comentario || null,
        es_urgente: esUrgente,
      });

      onCreated?.();
    } catch (_) {
      // Error ya manejado por el hook
    }
  };

  // ─── Toggle selección OC base ─────────────────────────────────────────────
  const toggleOcBase = (id) => {
    setOcBaseSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ─── Nombre de tipo seleccionado ──────────────────────────────────────────
  const tipoSeleccionado = tipos.find(t => t.id === Number(tipoId));
  const proveedorSeleccionado = proveedores.find(p => p.id === Number(proveedorId));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Nueva OC Incrementable</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <Stepper activeStep={activeStep} sx={{ px: 3, pb: 2 }}>
        {STEPS.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Divider />

      <DialogContent sx={{ overflowY: 'auto', py: 3 }}>

        {loadingIniciales ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ─────────────────────────────────────────────────────────────
                STEP 1: Tipo y Costo
            ───────────────────────────────────────────────────────────── */}
            {activeStep === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                <FormControl fullWidth required>
                  <InputLabel>Tipo de Incrementable</InputLabel>
                  <Select
                    value={tipoId}
                    label="Tipo de Incrementable"
                    onChange={e => setTipoId(e.target.value)}
                  >
                    {tipos.map(t => (
                      <MenuItem key={t.id} value={t.id}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{t.nombre}</Typography>
                          <Typography variant="caption" color="text.secondary">{t.codigo}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Autocomplete
                  options={proveedores}
                  getOptionLabel={p => p.razon_social || p.marca || `#${p.id}`}
                  value={proveedores.find(p => p.id === Number(proveedorId)) || null}
                  onChange={(_, v) => setProveedorId(v?.id || '')}
                  renderInput={params => (
                    <TextField {...params} label="Proveedor del incrementable" required />
                  )}
                />

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Monto Total"
                    type="number"
                    value={montoTotal}
                    onChange={e => setMontoTotal(e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    required
                    sx={{ flex: 2 }}
                  />
                  <FormControl sx={{ flex: 1 }} required>
                    <InputLabel>Moneda</InputLabel>
                    <Select value={moneda} label="Moneda" onChange={e => setMoneda(e.target.value)}>
                      {(monedas.length > 0 ? monedas : MONEDAS_COMUNES.map(c => ({ codigo: c, nombre: c }))).map(m => (
                        <MenuItem key={m.codigo} value={m.codigo}>{m.codigo}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <TextField
                  label="Comentario (opcional)"
                  multiline
                  rows={2}
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                />

                <FormControlLabel
                  control={<Switch checked={esUrgente} onChange={e => setEsUrgente(e.target.checked)} color="error" />}
                  label="Marcar como URGENTE"
                />
              </Box>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STEP 2: Seleccionar OC Base
            ───────────────────────────────────────────────────────────── */}
            {activeStep === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Selecciona las OC de Importación a las que aplica este {tipoSeleccionado?.nombre}.
                  El costo de {fmtMonto(montoTotal, moneda)} se distribuirá proporcionalmente al valor de cada artículo.
                </Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                        <TableCell padding="checkbox" />
                        <TableCell>OC</TableCell>
                        <TableCell>Proveedor</TableCell>
                        <TableCell>Proyecto / Sitio</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell>Moneda</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ocsImpo.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Alert severity="info">No hay OC de importación disponibles.</Alert>
                          </TableCell>
                        </TableRow>
                      ) : (
                        ocsImpo.map(oc => {
                          const checked = ocBaseSeleccionadas.includes(oc.id);
                          return (
                            <TableRow
                              key={oc.id}
                              hover
                              sx={{ cursor: 'pointer', bgcolor: checked ? 'primary.50' : 'inherit' }}
                              onClick={() => toggleOcBase(oc.id)}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox checked={checked} size="small" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={700} color="primary.main">
                                  {oc.numero_oc}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{oc.proveedor_nombre || oc.proveedor_marca || '—'}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{oc.proyecto_nombre}</Typography>
                                <Typography variant="caption" color="text.secondary">{oc.sitio_nombre}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={600}>
                                  {Number(oc.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={oc.moneda || '—'} size="small" />
                              </TableCell>
                              <TableCell>
                                <Chip label={oc.status} size="small" color="default" />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Resumen selección */}
                {ocBaseSeleccionadas.length > 0 && (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    {ocBaseSeleccionadas.length} OC seleccionada{ocBaseSeleccionadas.length !== 1 ? 's' : ''}
                  </Alert>
                )}

                {/* Tipos de cambio (si hay monedas mixtas) */}
                {monedasQueNecesitanTc.length > 0 && (
                  <Box sx={{ p: 2, bgcolor: 'amber.50', border: '1px solid', borderColor: 'warning.light', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Tipos de Cambio (respecto al MXN)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Se detectaron artículos en distintas monedas. Ingresa el TC para calcular la proporción correctamente.
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                      {monedasQueNecesitanTc.map(m => (
                        <TextField
                          key={m}
                          label={`1 ${m} = ? MXN`}
                          type="number"
                          size="small"
                          value={tipoCambios[m] || ''}
                          onChange={e => setTipoCambios(prev => ({ ...prev, [m]: e.target.value }))}
                          inputProps={{ min: 0, step: 0.0001 }}
                          sx={{ width: 150 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STEP 3: Preview distribución + Confirmar
            ───────────────────────────────────────────────────────────── */}
            {activeStep === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Resumen de la OC a crear */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Resumen de la OC Incrementable</Typography>
                  <Stack direction="row" spacing={3} flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" color="text.secondary">Tipo</Typography>
                      <Typography variant="body2" fontWeight={600}>{tipoSeleccionado?.nombre}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Proveedor</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {proveedorSeleccionado?.razon_social || proveedorSeleccionado?.marca}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Monto Total</Typography>
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {fmtMonto(montoTotal, moneda)}
                      </Typography>
                    </Box>
                    {esUrgente && (
                      <Chip label="URGENTE" color="error" size="small" />
                    )}
                  </Stack>
                </Paper>

                {/* Distribución por artículo */}
                <Typography variant="subtitle2" fontWeight={700}>
                  Distribución proporcional por artículo
                </Typography>

                {loadingPreview ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : distribucion.length === 0 ? (
                  <Alert severity="warning">
                    No se encontraron artículos en las OC base seleccionadas (con material_id).
                    Verifica que las OC base tengan líneas de material registradas.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                          <TableCell>Material</TableCell>
                          <TableCell>OC Base</TableCell>
                          <TableCell>Proyecto</TableCell>
                          <TableCell align="right">Costo Base</TableCell>
                          <TableCell align="right">%</TableCell>
                          <TableCell align="right">Monto Incr.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {distribucion.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{item.material_nombre}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={item.numero_oc} size="small" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{item.proyecto_nombre}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {fmtMonto(item.costo_base, item.moneda)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600} color="primary.main">
                                {fmtPct(item.porcentaje_asignado)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={700}>
                                {fmtMonto(item.monto_incrementable, item.moneda_incrementable)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Fila totales */}
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell colSpan={4} />
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700}>100%</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700} color="primary.main">
                              {fmtMonto(montoTotal, moneda)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Alert severity="info">
                  Al confirmar se creará la OC, se generará el PDF y se enviará por correo al grupo de notificaciones.
                  La distribución se aplicará al inventario cuando la OC se cierre en REC_OC.
                </Alert>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>

        <Box sx={{ flex: 1 }} />

        {activeStep > 0 && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            disabled={isSubmitting || loadingPreview}
            variant="outlined"
          >
            Anterior
          </Button>
        )}

        {activeStep < STEPS.length - 1 ? (
          <Button
            endIcon={<ArrowForwardIcon />}
            onClick={handleNext}
            variant="contained"
            disabled={
              (activeStep === 0 && !step1Valid) ||
              (activeStep === 1 && !step2Valid) ||
              loadingPreview
            }
          >
            {activeStep === 1 ? 'Calcular Distribución' : 'Siguiente'}
          </Button>
        ) : (
          <Button
            onClick={handleConfirmar}
            variant="contained"
            color="success"
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            disabled={isSubmitting || distribucion.length === 0}
            sx={{ fontWeight: 700 }}
          >
            {isSubmitting ? 'Creando OC…' : 'Confirmar y Crear OC'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
