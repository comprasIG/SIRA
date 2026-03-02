// sira-front/src/components/-requisiciones/ModalAgregarRegistro.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button, CircularProgress,
  Autocomplete, Alert, FormControlLabel, Checkbox, Collapse, Divider,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import { toast } from 'react-toastify';
import api from '../../api/api';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 520,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  maxHeight: '90vh',
  overflowY: 'auto',
};

function FormNuevoTipo({ onCrear, onCancelar, isSubmitting }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [requiereNumSerie, setRequiereNumSerie] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) { toast.error('El nombre es obligatorio.'); return; }
    onCrear({ nombre: nombre.trim(), descripcion: descripcion.trim(), requiere_num_serie: requiereNumSerie });
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Nombre del nuevo tipo" required fullWidth value={nombre} onChange={e => setNombre(e.target.value)} size="small" />
        <TextField label="Descripcion (opcional)" fullWidth value={descripcion} onChange={e => setDescripcion(e.target.value)} size="small" />
        <FormControlLabel
          control={<Checkbox checked={requiereNumSerie} onChange={e => setRequiereNumSerie(e.target.checked)} />}
          label="Requiere numero de serie"
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onCancelar} disabled={isSubmitting}>Cancelar</Button>
          <Button size="small" variant="contained" type="submit" disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}>
            Crear
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function ModalAgregarRegistro({ open, onClose, unidad, onRegistroCreado }) {
  const {
    eventoTipos, loadingEventoTipos, isSubmitting,
    agregarRegistroManual, crearEventoTipo,
  } = useUnidadServicios();

  const [eventoTipo,      setEventoTipo]      = useState(null);
  const [kilometraje,     setKilometraje]     = useState('');
  const [descripcion,     setDescripcion]     = useState('');
  const [costoTotal,      setCostoTotal]      = useState('');
  const [numerosSerie,    setNumerosSerie]    = useState('');
  const [esAlerta,        setEsAlerta]        = useState(false);
  const [mostrarNuevoTipo, setMostrarNuevoTipo] = useState(false);

  // Campos extra para COMBUSTIBLE
  const [sitios,          setSitios]          = useState([]);
  const [proyectos,       setProyectos]       = useState([]);
  const [sitioDestino,    setSitioDestino]    = useState(null);
  const [proyectoDestino, setProyectoDestino] = useState(null);
  const [loadingSitios,   setLoadingSitios]   = useState(false);

  useEffect(() => {
    if (unidad) {
      setEventoTipo(null);
      setDescripcion('');
      setKilometraje(typeof unidad.km === 'number' ? unidad.km : '');
      setCostoTotal('');
      setNumerosSerie('');
      setEsAlerta(false);
      setMostrarNuevoTipo(false);
      setSitioDestino(null);
      setProyectoDestino(null);
    }
  }, [unidad, open]);

  // Cargar sitios y proyectos la primera vez que se selecciona tipo COMBUSTIBLE
  useEffect(() => {
    if (eventoTipo?.codigo === 'COMBUSTIBLE' && sitios.length === 0) {
      setLoadingSitios(true);
      Promise.all([api.get('/api/sitios'), api.get('/api/proyectos')])
        .then(([s, p]) => { setSitios(s); setProyectos(p); })
        .catch(() => {})
        .finally(() => setLoadingSitios(false));
    }
  }, [eventoTipo, sitios.length]);

  // Solo tipos que NO generan requisicion (manuales)
  const tiposManuales = useMemo(
    () => eventoTipos.filter(t => !t.genera_requisicion),
    [eventoTipos]
  );

  const esCombustible = eventoTipo?.codigo === 'COMBUSTIBLE';

  // Si el tipo es INCIDENCIA, activar alerta por defecto
  useEffect(() => {
    if (eventoTipo?.codigo === 'INCIDENCIA') {
      setEsAlerta(true);
    }
  }, [eventoTipo]);

  const handleCrearNuevoTipo = async (datos) => {
    const nuevo = await crearEventoTipo(datos);
    if (nuevo) {
      setEventoTipo(nuevo);
      setMostrarNuevoTipo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = parseInt(kilometraje, 10);

    const esCombustible = eventoTipo?.codigo === 'COMBUSTIBLE';

    if (!eventoTipo) { toast.error('Selecciona un tipo de evento.'); return; }
    if (!kmNum && kmNum !== 0) { toast.error('El kilometraje es obligatorio.'); return; }
    if (typeof unidad.km === 'number' && kmNum < unidad.km) {
      toast.error('El kilometraje no puede ser menor al ultimo registrado (' + unidad.km.toLocaleString('es-MX') + ' km).');
      return;
    }
    if (esCombustible && (!costoTotal || parseFloat(costoTotal) <= 0)) {
      toast.error('Para carga de combustible el costo total es obligatorio.');
      return;
    }
    if (!esCombustible && !descripcion.trim()) { toast.error('La descripcion es obligatoria.'); return; }

    const payload = {
      unidad_id:          unidad.id,
      evento_tipo_id:     eventoTipo.id,
      kilometraje:        kmNum,
      descripcion,
      costo_total:        costoTotal || 0,
      numeros_serie:      numerosSerie?.trim() || null,
      es_alerta:          esAlerta,
      // Solo para COMBUSTIBLE
      sitio_destino_id:   sitioDestino?.id    || null,
      proyecto_destino_id: proyectoDestino?.id || null,
    };

    const exito = await agregarRegistroManual(payload);
    if (exito) { onRegistroCreado?.(); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        <Typography variant="h6">Registrar Evento:</Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>

        {loadingEventoTipos ? <CircularProgress sx={{ display: 'block', mt: 2 }} /> : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5} sx={{ mt: 2 }}>

              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Autocomplete
                  options={tiposManuales}
                  getOptionLabel={(o) => o.nombre}
                  value={eventoTipo}
                  onChange={(_, v) => { setEventoTipo(v); setEsAlerta(false); }}
                  fullWidth
                  renderInput={(params) => <TextField {...params} label="Tipo de Evento" required />}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => setMostrarNuevoTipo(!mostrarNuevoTipo)}
                  sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
                  title="Crear nuevo tipo de evento"
                >
                  Nuevo
                </Button>
              </Stack>

              <Collapse in={mostrarNuevoTipo}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Crear tipo de evento personalizado</Typography>
                  <FormNuevoTipo
                    onCrear={handleCrearNuevoTipo}
                    onCancelar={() => setMostrarNuevoTipo(false)}
                    isSubmitting={isSubmitting}
                  />
                </Box>
              </Collapse>

              <TextField
                label="Kilometraje Actual"
                type="number"
                required
                fullWidth
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                helperText={'Ultimo registro: ' + (typeof unidad?.km === 'number' ? unidad.km.toLocaleString('es-MX') : 'N/A') + ' km'}
              />

              <TextField
                label={esCombustible ? 'Descripcion del Evento (opcional)' : 'Descripcion del Evento'}
                multiline
                rows={3}
                fullWidth
                required={!esCombustible}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el evento, incidencia o carga de combustible..."
              />

              <TextField
                label={esCombustible ? 'Costo Total $' : 'Costo Total (Opcional) $'}
                type="number"
                fullWidth
                required={esCombustible}
                value={costoTotal}
                onChange={(e) => setCostoTotal(e.target.value)}
                helperText={esCombustible ? 'Requerido para carga de combustible.' : 'Si el evento tuvo un costo, ingresalo aqui.'}
                inputProps={{ min: 0, step: '0.01' }}
              />

              {/* Campos extra: Sitio/Proyecto destino — solo para COMBUSTIBLE */}
              <Collapse in={esCombustible}>
                <Stack spacing={2}>
                  {loadingSitios ? (
                    <CircularProgress size={20} sx={{ alignSelf: 'center' }} />
                  ) : (
                    <>
                      <Autocomplete
                        options={sitios}
                        getOptionLabel={(s) => s.nombre || ''}
                        value={sitioDestino}
                        onChange={(_, v) => { setSitioDestino(v); setProyectoDestino(null); }}
                        fullWidth
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Sitio Destino (opcional)"
                            size="small"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <MyLocationIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} />
                              ),
                            }}
                          />
                        )}
                      />
                      <Autocomplete
                        options={
                          sitioDestino
                            ? proyectos.filter((p) => p.sitio_id === sitioDestino.id)
                            : proyectos
                        }
                        getOptionLabel={(p) => p.nombre || ''}
                        value={proyectoDestino}
                        onChange={(_, v) => setProyectoDestino(v)}
                        fullWidth
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Proyecto Destino (opcional)"
                            size="small"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <FolderOpenIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} />
                              ),
                            }}
                          />
                        )}
                      />
                    </>
                  )}
                </Stack>
              </Collapse>

              {(eventoTipo?.requiere_num_serie || (numerosSerie && numerosSerie.trim())) ? (
                <TextField
                  label={eventoTipo?.requiere_num_serie ? 'Numero de Serie (requerido)' : 'Numero de Serie (opcional)'}
                  fullWidth
                  required={eventoTipo?.requiere_num_serie}
                  value={numerosSerie}
                  onChange={(e) => setNumerosSerie(e.target.value)}
                  helperText="Ej. numero de bateria, llanta, refaccion..."
                />
              ) : (
                <Button
                  size="small"
                  variant="text"
                  sx={{ alignSelf: 'flex-start', p: 0, fontSize: '0.78rem' }}
                  onClick={() => setNumerosSerie(' ')}
                >
                  + Agregar numero de serie
                </Button>
              )}

              <Divider />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={esAlerta}
                    onChange={(e) => setEsAlerta(e.target.checked)}
                    color="error"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <WarningAmberIcon fontSize="small" color="error" />
                    <Typography variant="body2">
                      Reportar como incidencia (genera alerta para compras / responsable)
                    </Typography>
                  </Stack>
                }
              />

              {esAlerta && (
                <Alert severity="warning" variant="outlined" sx={{ fontSize: '0.82rem' }}>
                  Esta incidencia aparecera como alerta activa en el card de la unidad
                  hasta que el equipo de compras o el responsable la cierre desde la bitacora.
                </Alert>
              )}

              <Alert severity="info" variant="outlined" sx={{ fontSize: '0.82rem' }}>
                Este registro se agrega directamente a la bitacora y no genera requisicion.
                Para servicios que requieren compra, usa el boton "Servicio".
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 1 }}>
                <Button onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  color={esAlerta ? 'error' : 'primary'}
                  startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {isSubmitting ? 'Guardando...' : esAlerta ? 'Reportar Incidencia' : 'Guardar Registro'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
