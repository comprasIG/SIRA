// sira-front/src/components/ING_OC/IngresoOCModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Button, Stack, CircularProgress, TextField,
  IconButton, Collapse, Autocomplete, Tooltip, Paper, Divider, Chip
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

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
  }, [detalles, open]);

  const handleItemChange = (detalle_id, field, value) => {
    setItemsState(prev => prev.map(item =>
      item.detalle_id === detalle_id ? { ...item, [field]: value } : item
    ));
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
      await onRegistrar(payload);
    } catch (error) {
      setIsSubmitting(false);
    }
  };

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
                        <Typography variant="body2" fontWeight={500}>{materialLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {`Faltan ${Math.max(0, parseFloat(item.cantidad_pedida) - parseFloat(item.cantidad_recibida))} ${item.unidad_simbolo}`}
                        </Typography>
                      </Stack>

                    <Typography variant="body2" align="right">{item.cantidad_pedida} {item.unidad_simbolo}</Typography>
                    <Typography variant="body2" align="right">{item.cantidad_recibida} {item.unidad_simbolo}</Typography>

                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad_a_ingresar}
                      onChange={(e) => handleItemChange(item.detalle_id, 'cantidad_a_ingresar', e.target.value)}
                      sx={{ maxWidth: 100, justifySelf: 'end' }}
                      inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                      disabled={!!item.incidencia?.tipo_id}
                    />

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
