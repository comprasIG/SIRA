// sira-front/src/components/ING_OC/IngresoOCModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Button, Stack, CircularProgress, TextField,
  IconButton, Collapse, Autocomplete, Tooltip, Paper, Divider, Chip,
  Select, MenuItem, FormControl, InputLabel, Alert,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';

const ModalContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'clamp(320px, 92vw, 920px)',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 4,
  overflow: 'hidden',
  boxShadow: `0 32px 80px ${alpha(theme.palette.primary.main, 0.25)}`,
  backgroundColor: theme.palette.background.paper,
}));

const ContentBox = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  flexGrow: 1,
  padding: theme.spacing(3),
  backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 18%)`,
}));

const ItemRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasIssue',
})(({ theme, hasIssue }) => ({
  display: 'grid',
  gridTemplateColumns: '2.4fr repeat(3, minmax(90px, 1fr)) 120px',
  gap: theme.spacing(2),
  alignItems: 'center',
  padding: theme.spacing(1.5, 0),
  borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  backgroundColor: hasIssue ? alpha(theme.palette.error.main, 0.08) : 'transparent',
  borderRadius: hasIssue ? theme.shape.borderRadius : 0,
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  transition: 'background-color 0.2s ease',
}));

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MODOS = {
  DEJAR_PENDIENTE: 'DEJAR_PENDIENTE',
  SOLO_ASIGNAR: 'SOLO_ASIGNAR',
  ASIGNAR_Y_ENTREGAR: 'ASIGNAR_Y_ENTREGAR',
};

export default function IngresoOCModal({
  open,
  onClose,
  oc,
  detalles,
  loadingDetalles,
  ubicaciones,
  tiposIncidencia,
  onRegistrar,
}) {
  const [itemsState, setItemsState] = useState([]);
  const [selectedUbicacion, setSelectedUbicacion] = useState(null); // number|null
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Paso 2: asignación de activos físicos ──────────────────────────────────
  const [step, setStep] = useState(1);
  const [activosPendientes, setActivosPendientes] = useState([]); // [{ id, sku, nombre }]
  const [asignaciones, setAsignaciones] = useState({}); // { [id]: { modo, empleado_id, ubicacion_af_id } }
  const [empleados, setEmpleados] = useState([]);
  const [ubicacionesAF, setUbicacionesAF] = useState([]);
  const [globalAsig, setGlobalAsig] = useState({ modo: MODOS.SOLO_ASIGNAR, empleado_id: null, ubicacion_af_id: null });
  const [isSavingAsig, setIsSavingAsig] = useState(false);

  // ✅ Regla robusta: el backend nos dice si entra a disponible (almacén central)
  // Evitamos depender de strings tipo "STOCK ALMACEN".
  const isStock = !!oc?.entra_a_disponible;

  useEffect(() => {
    if (detalles && detalles.length > 0) {
      setItemsState(detalles.map(d => ({
        ...d, // detalle_id, material_id, precio_unitario, moneda, etc.
        cantidad_a_ingresar: '',
        showIncidenciaForm: false,
        incidencia: {
          tipo_id: '',
          cantidad_afectada: '',
          descripcion: ''
        }
      })));
    } else {
      setItemsState([]);
    }

    setSelectedUbicacion(null);
    setIsSubmitting(false);
    setStep(1);
    setActivosPendientes([]);
    setAsignaciones({});
  }, [detalles, open]);

  // Cargar empleados y ubicaciones AF cuando llegue al paso 2
  useEffect(() => {
    if (step !== 2) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('firebaseToken') || ''}` };
    Promise.all([
      fetch(`${API_BASE_URL}/api/empleados/list`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE_URL}/api/activos-fisicos/ubicaciones`, { headers }).then(r => r.json()).catch(() => []),
    ]).then(([emps, ubics]) => {
      setEmpleados(Array.isArray(emps) ? emps : []);
      setUbicacionesAF(Array.isArray(ubics) ? ubics : []);
    });
  }, [step]);

  const handleItemChange = (detalle_id, field, value) => {
    setItemsState(prev => prev.map(item => {
      if (item.detalle_id !== detalle_id) return item;

      // Clampar cantidad_a_ingresar al faltante
      if (field === 'cantidad_a_ingresar') {
        const faltante = Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida));
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > faltante) {
          return { ...item, [field]: faltante.toString() };
        }
      }

      return { ...item, [field]: value };
    }));
  };

  const handleIncidenciaChange = (detalle_id, field, value) => {
    setItemsState(prev => prev.map(item =>
      item.detalle_id === detalle_id
        ? { ...item, incidencia: { ...item.incidencia, [field]: value } }
        : item
    ));
  };

  const toggleIncidenciaForm = (detalle_id) => {
    setItemsState(prev => prev.map(item =>
      item.detalle_id === detalle_id
        ? { ...item, showIncidenciaForm: !item.showIncidenciaForm }
        : item
    ));
  };

  const handleIngresarTodo = () => {
    setItemsState(prev => prev.map(item => {
      const faltante = Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida));
      return {
        ...item,
        cantidad_a_ingresar: faltante > 0 ? faltante.toString() : '',
        showIncidenciaForm: false,
        incidencia: { tipo_id: '', cantidad_afectada: '', descripcion: '' }
      };
    }));
  };

  const handleSubmit = async () => {
    // ✅ Ubicación:
    // - En stock es RECOMENDABLE elegirla
    // - Pero NO bloqueamos: el backend resuelve "SIN_UBICACION" o un fallback
    if (isStock && !selectedUbicacion) {
      const ok = window.confirm(
        'No seleccionaste una ubicación física. Se usará la ubicación por defecto (ej. "SIN UBICACIÓN"). ¿Deseas continuar?'
      );
      if (!ok) return;
    }

    const itemsPayload = itemsState
      .filter(item => parseFloat(item.cantidad_a_ingresar) > 0 || item.incidencia?.tipo_id)
      .map(item => ({
        detalle_id: item.detalle_id,
        material_id: item.material_id,
        cantidad_ingresada_ahora: parseFloat(item.cantidad_a_ingresar) || 0,
        precio_unitario: item.precio_unitario,
        moneda: item.moneda,
        incidencia: item.incidencia?.tipo_id ? {
          tipo_id: item.incidencia.tipo_id,
          cantidad_afectada: parseFloat(item.incidencia.cantidad_afectada) || null,
          descripcion: item.incidencia.descripcion
        } : null
      }));

    if (itemsPayload.length === 0) {
      alert('No has ingresado ninguna cantidad ni reportado incidencias.');
      return;
    }

    const payload = {
      orden_compra_id: oc.id,
      items: itemsPayload,
      // ✅ Si no viene, backend resuelve default
      ubicacion_id: selectedUbicacion || null,
    };

    setIsSubmitting(true);
    try {
      const result = await onRegistrar(payload);
      const nuevosActivos = result?.activos_fisicos_creados ?? [];
      if (nuevosActivos.length > 0) {
        // Inicializar asignaciones en modo "dejar pendiente" por defecto
        const initAsig = {};
        nuevosActivos.forEach(a => {
          initAsig[a.id] = { modo: MODOS.DEJAR_PENDIENTE, empleado_id: null, ubicacion_af_id: null };
        });
        setActivosPendientes(nuevosActivos);
        setAsignaciones(initAsig);
        setStep(2);
      } else {
        onClose();
      }
    } catch (error) {
      // error ya fue mostrado por el hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAsigChange = (activoId, field, value) => {
    setAsignaciones(prev => ({
      ...prev,
      [activoId]: { ...prev[activoId], [field]: value },
    }));
  };

  const aplicarGlobal = () => {
    setAsignaciones(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], ...globalAsig };
      });
      return next;
    });
  };

  const handleGuardarAsignaciones = async () => {
    const aAsignar = activosPendientes.filter(a => asignaciones[a.id]?.modo !== MODOS.DEJAR_PENDIENTE);
    if (aAsignar.length === 0) {
      onClose();
      return;
    }

    const token = localStorage.getItem('firebaseToken') || '';
    setIsSavingAsig(true);
    try {
      for (const activo of aAsignar) {
        const asig = asignaciones[activo.id];
        if (!asig.empleado_id) continue; // ALTO requiere al menos empleado
        const body = {
          tipo_movimiento: 'ALTA',
          usuario_id: null, // el backend toma req.siraUser.id
          empleado_responsable_nuevo_id: asig.empleado_id,
          ubicacion_nueva_id: asig.modo === MODOS.ASIGNAR_Y_ENTREGAR ? asig.ubicacion_af_id : null,
        };
        await fetch(`${API_BASE_URL}/api/activos-fisicos/${activo.id}/movimientos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
    } finally {
      setIsSavingAsig(false);
      onClose();
    }
  };

  if (step === 2) {
    return (
      <Modal open={open} onClose={onClose}>
        <ModalContainer sx={{ maxWidth: 860 }}>
          {/* Cabecera paso 2 */}
          <Box sx={{ px: 4, py: 3, backgroundImage: (t) => `linear-gradient(135deg, ${alpha(t.palette.warning.main, 0.14)} 0%, ${alpha(t.palette.warning.main, 0.04)} 60%, ${t.palette.background.paper} 100%)` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="overline" color="warning.dark" sx={{ letterSpacing: 1.2 }}>
                  Paso 2 de 2 — Opcional
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  Asignación de Activos Físicos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {activosPendientes.length} activo{activosPendientes.length !== 1 ? 's' : ''} creado{activosPendientes.length !== 1 ? 's' : ''} · Asígnalos ahora o hazlo después desde Activo Físico
                </Typography>
              </Box>
              <AssignmentIndOutlinedIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.6 }} />
            </Stack>
          </Box>

          <Divider />

          <ContentBox>
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>
              Los activos sin asignación quedarán pendientes en la pestaña <strong>"Pendientes"</strong> de Activo Físico.
            </Alert>

            {/* Aplicar a todos */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                Aplicar a todos igual
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Modo</InputLabel>
                  <Select
                    label="Modo"
                    value={globalAsig.modo}
                    onChange={e => setGlobalAsig(g => ({ ...g, modo: e.target.value }))}
                  >
                    <MenuItem value={MODOS.DEJAR_PENDIENTE}>Dejar pendiente</MenuItem>
                    <MenuItem value={MODOS.SOLO_ASIGNAR}>Solo asignar responsable</MenuItem>
                    <MenuItem value={MODOS.ASIGNAR_Y_ENTREGAR}>Asignar y entregar</MenuItem>
                  </Select>
                </FormControl>
                {globalAsig.modo !== MODOS.DEJAR_PENDIENTE && (
                  <Autocomplete
                    size="small"
                    sx={{ minWidth: 240, flex: 1 }}
                    options={empleados}
                    getOptionLabel={e => e.nombre_completo || `${e.nombre} ${e.apellido_paterno}` || ''}
                    value={empleados.find(e => e.id === globalAsig.empleado_id) || null}
                    onChange={(_, v) => setGlobalAsig(g => ({ ...g, empleado_id: v?.id ?? null }))}
                    renderInput={params => <TextField {...params} label="Responsable" />}
                  />
                )}
                {globalAsig.modo === MODOS.ASIGNAR_Y_ENTREGAR && (
                  <Autocomplete
                    size="small"
                    sx={{ minWidth: 200, flex: 1 }}
                    options={ubicacionesAF}
                    getOptionLabel={u => u.nombre || ''}
                    value={ubicacionesAF.find(u => u.id === globalAsig.ubicacion_af_id) || null}
                    onChange={(_, v) => setGlobalAsig(g => ({ ...g, ubicacion_af_id: v?.id ?? null }))}
                    renderInput={params => <TextField {...params} label="Ubicación destino" />}
                  />
                )}
                <Button variant="outlined" size="small" onClick={aplicarGlobal} sx={{ whiteSpace: 'nowrap' }}>
                  Aplicar a todos
                </Button>
              </Stack>
            </Paper>

            {/* Tabla por activo */}
            <Stack spacing={1.5}>
              {activosPendientes.map(activo => {
                const asig = asignaciones[activo.id] || { modo: MODOS.DEJAR_PENDIENTE, empleado_id: null, ubicacion_af_id: null };
                return (
                  <Paper key={activo.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
                      <Box sx={{ minWidth: 160 }}>
                        <Typography variant="caption" color="text.secondary">SKU</Typography>
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{activo.sku}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{activo.nombre}</Typography>
                      </Box>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Acción</InputLabel>
                        <Select
                          label="Acción"
                          value={asig.modo}
                          onChange={e => handleAsigChange(activo.id, 'modo', e.target.value)}
                        >
                          <MenuItem value={MODOS.DEJAR_PENDIENTE}>Dejar pendiente</MenuItem>
                          <MenuItem value={MODOS.SOLO_ASIGNAR}>Solo asignar responsable</MenuItem>
                          <MenuItem value={MODOS.ASIGNAR_Y_ENTREGAR}>Asignar y entregar</MenuItem>
                        </Select>
                      </FormControl>
                      {asig.modo !== MODOS.DEJAR_PENDIENTE && (
                        <Autocomplete
                          size="small"
                          sx={{ minWidth: 220, flex: 1 }}
                          options={empleados}
                          getOptionLabel={e => e.nombre_completo || `${e.nombre} ${e.apellido_paterno}` || ''}
                          value={empleados.find(e => e.id === asig.empleado_id) || null}
                          onChange={(_, v) => handleAsigChange(activo.id, 'empleado_id', v?.id ?? null)}
                          renderInput={params => <TextField {...params} label="Responsable *" />}
                        />
                      )}
                      {asig.modo === MODOS.ASIGNAR_Y_ENTREGAR && (
                        <Autocomplete
                          size="small"
                          sx={{ minWidth: 180, flex: 1 }}
                          options={ubicacionesAF}
                          getOptionLabel={u => u.nombre || ''}
                          value={ubicacionesAF.find(u => u.id === asig.ubicacion_af_id) || null}
                          onChange={(_, v) => handleAsigChange(activo.id, 'ubicacion_af_id', v?.id ?? null)}
                          renderInput={params => <TextField {...params} label="Ubicación" />}
                        />
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </ContentBox>

          <Divider />
          <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ px: 4, py: 3 }}>
            <Button
              variant="text"
              startIcon={<SkipNextOutlinedIcon />}
              onClick={onClose}
              disabled={isSavingAsig}
            >
              Dejar todos pendientes
            </Button>
            <Button
              variant="contained"
              onClick={handleGuardarAsignaciones}
              disabled={isSavingAsig}
              startIcon={isSavingAsig ? <CircularProgress size={18} color="inherit" /> : <AssignmentIndOutlinedIcon />}
              sx={{ minWidth: 200, fontWeight: 600, textTransform: 'none', boxShadow: 'none' }}
            >
              {isSavingAsig ? 'Guardando…' : 'Guardar asignaciones'}
            </Button>
          </Stack>
        </ModalContainer>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalContainer>
        <Box
          sx={{
            px: 4,
            py: 3,
            backgroundImage: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 60%, ${theme.palette.background.paper} 100%)`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={3}>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1.2 }} color="primary">
                Ingreso de OC
              </Typography>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                {oc?.numero_oc}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={oc?.proveedor_marca} sx={{ backgroundColor: alpha('#000', 0.04) }} />
                <Chip size="small" label={oc?.proyecto_nombre} variant="outlined" />
                {isStock && <Chip size="small" color="primary" variant="outlined" label="Ingreso a STOCK" />}
              </Stack>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Sitio: {oc?.sitio_nombre}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: (theme) => alpha(theme.palette.primary.main, 0.12) }} />

        <ContentBox>
          {loadingDetalles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {isStock && (
                <Autocomplete
                  sx={{ mb: 3 }}
                  options={Array.isArray(ubicaciones) ? ubicaciones : []}
                  getOptionLabel={(o) => {
                    if (!o) return '';
                    const cod = o.codigo ?? '';
                    const nom = o.nombre ?? '';
                    return `${cod} - ${nom}`.trim();
                  }}
                  value={(Array.isArray(ubicaciones) ? ubicaciones : []).find(u => u.id === selectedUbicacion) || null}
                  onChange={(_, v) => setSelectedUbicacion(v?.id ?? null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Ubicación destino en almacén (recomendado)"
                      helperText='Si no eliges, se usará la ubicación por defecto (ej. "SIN UBICACIÓN").'
                    />
                  )}
                />
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={2}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  Detalle de materiales
                </Typography>
                <Button variant="outlined" size="small" onClick={handleIngresarTodo}>
                  Ingresar todo lo faltante
                </Button>
              </Stack>

              <ItemRow sx={{
                fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem',
                letterSpacing: 0.4, borderBottom: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}>
                <Typography variant="caption">Material</Typography>
                <Typography variant="caption" align="right">Pedido</Typography>
                <Typography variant="caption" align="right">Recibido</Typography>
                <Typography variant="caption" align="right">Ingresar</Typography>
                <Typography variant="caption" align="center">Incidencia</Typography>
              </ItemRow>

              {itemsState.map(item => {
                const materialLabel = item.sku
                  ? `${item.sku} — ${item.material_nombre}`
                  : item.material_nombre;

                return (
                  <Box key={item.detalle_id}>
                    <ItemRow hasIssue={!!item.incidencia?.tipo_id}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" fontWeight={500}>{materialLabel}</Typography>
                          {item.es_activo_fijo && (
                            <Chip
                              label="Activo Fijo"
                              size="small"
                              sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 10, height: 18, borderRadius: '6px' }}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {`Faltan ${Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida))} ${item.unidad_simbolo}`}
                          {item.es_activo_fijo && ' · Al recibir se crearán registros en Activo Físico'}
                        </Typography>
                      </Stack>

                      <Typography variant="body2" align="right">{item.cantidad_pedida} {item.unidad_simbolo}</Typography>
                      <Typography variant="body2" align="right">{item.cantidad_recibida} {item.unidad_simbolo}</Typography>

                      {(() => {
                        const faltante = Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida));
                        return (
                          <TextField
                            size="small"
                            type="number"
                            value={item.cantidad_a_ingresar}
                            onChange={(e) => handleItemChange(item.detalle_id, 'cantidad_a_ingresar', e.target.value)}
                            sx={{ maxWidth: 110, justifySelf: 'end' }}
                            inputProps={{ min: 0, max: faltante, step: 'any', style: { textAlign: 'right' } }}
                            helperText={`Máx: ${faltante}`}
                            disabled={!!item.incidencia?.tipo_id || faltante <= 0}
                          />
                        );
                      })()}

                      <Tooltip title="Reportar incidencia" arrow>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => toggleIncidenciaForm(item.detalle_id)}
                            color={item.incidencia?.tipo_id ? 'error' : 'default'}
                          >
                            <ReportProblemOutlinedIcon />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </ItemRow>

                    <Collapse in={item.showIncidenciaForm}>
                      <Paper
                        sx={{
                          p: 2,
                          my: 1.5,
                          backgroundColor: alpha('#F44336', 0.08),
                          borderLeft: (theme) => `4px solid ${theme.palette.error.main}`,
                        }}
                      >
                        <Typography variant="subtitle2" color="error.dark" gutterBottom>
                          Reportar incidencia para: {materialLabel}
                        </Typography>

                        <Stack spacing={1.5}>
                          <Autocomplete
                            size="small"
                            options={Array.isArray(tiposIncidencia) ? tiposIncidencia : []}
                            getOptionLabel={(o) => o?.descripcion || ''}
                            value={(Array.isArray(tiposIncidencia) ? tiposIncidencia : []).find(t => t.id === item.incidencia.tipo_id) || null}
                            onChange={(_, v) => handleIncidenciaChange(item.detalle_id, 'tipo_id', v?.id || '')}
                            renderInput={(params) => <TextField {...params} label="Tipo de incidencia" required />}
                          />

                          <TextField
                            size="small"
                            label="Cantidad afectada (opcional)"
                            type="number"
                            value={item.incidencia.cantidad_afectada}
                            onChange={(e) => handleIncidenciaChange(item.detalle_id, 'cantidad_afectada', e.target.value)}
                            inputProps={{ min: 0, step: 'any' }}
                          />

                          <TextField
                            size="small"
                            label="Descripción del problema"
                            multiline
                            rows={2}
                            required
                            value={item.incidencia.descripcion}
                            onChange={(e) => handleIncidenciaChange(item.detalle_id, 'descripcion', e.target.value)}
                          />

                          <Button
                            size="small"
                            variant="text"
                            color="inherit"
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={() => {
                              toggleIncidenciaForm(item.detalle_id);
                              handleIncidenciaChange(item.detalle_id, 'tipo_id', '');
                              handleIncidenciaChange(item.detalle_id, 'cantidad_afectada', '');
                              handleIncidenciaChange(item.detalle_id, 'descripcion', '');
                            }}
                          >
                            Cancelar incidencia
                          </Button>
                        </Stack>
                      </Paper>
                    </Collapse>
                  </Box>
                );
              })}
            </>
          )}
        </ContentBox>

        <Divider sx={{ borderColor: (theme) => alpha(theme.palette.primary.main, 0.12) }} />

        <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ px: 4, py: 3 }}>
          <Button onClick={onClose} disabled={isSubmitting} variant="text">
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loadingDetalles || isSubmitting || itemsState.length === 0}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon />}
            sx={{
              minWidth: 180,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              backgroundImage: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.92)} 0%, ${theme.palette.success.main} 100%)`,
              '&:hover': {
                boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.success.main, 0.32)}`,
              },
            }}
          >
            {isSubmitting ? 'Registrando…' : 'Registrar ingreso'}
          </Button>
        </Stack>
      </ModalContainer>
    </Modal>
  );
}
