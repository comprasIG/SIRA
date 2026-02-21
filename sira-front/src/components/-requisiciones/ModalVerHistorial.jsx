// sira-front/src/components/-requisiciones/ModalVerHistorial.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, Button, CircularProgress,
  List, ListItem, ListItemText, Divider, Paper, Chip,
  FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton,
  Alert,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildIcon from '@mui/icons-material/Build';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { useUnidadHistorial } from '../../hooks/useUnidadHistorial';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '92%',
  maxWidth: 760,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
};

const formatFecha = (fecha) => dayjs(fecha).format('DD/MMM/YYYY HH:mm');

const formatKm = (km) =>
  typeof km === 'number' ? Number(km).toLocaleString('es-MX') + ' km' : String(km || 0) + ' km';

function getEventoIcon(codigo) {
  if (!codigo) return null;
  const c = codigo.toUpperCase();
  if (c.includes('SERV') || c.includes('DIESEL')) return <BuildIcon fontSize="small" />;
  if (c.includes('COMBUSTIBLE') || c.includes('GASOLINA')) return <LocalGasStationIcon fontSize="small" />;
  if (c.includes('INCIDENCIA')) return <ReportProblemIcon fontSize="small" color="error" />;
  return null;
}

function getEventoColor(item) {
  if (item.es_alerta && !item.alerta_cerrada) return 'error';
  const c = (item.evento_codigo || '').toUpperCase();
  if (c.includes('SERV') || c.includes('DIESEL')) return 'info';
  if (c.includes('COMBUSTIBLE')) return 'success';
  if (c.includes('INCIDENCIA')) return 'warning';
  return 'default';
}

export default function ModalVerHistorial({ open, onClose, unidad, onAlertaCerrada }) {
  const { historial, loading, fetchHistorial } = useUnidadHistorial();
  const { eventoTipos, cerrarAlerta, isSubmitting } = useUnidadServicios();
  const [filtroTipoId, setFiltroTipoId] = useState('');

  useEffect(() => {
    if (open && unidad?.id) {
      setFiltroTipoId('');
      fetchHistorial(unidad.id);
    }
  }, [open, unidad, fetchHistorial]);

  // Re-fetch al cambiar filtro
  useEffect(() => {
    if (open && unidad?.id) {
      fetchHistorial(unidad.id, filtroTipoId || null);
    }
  }, [filtroTipoId]);

  const alertasAbiertas = useMemo(
    () => historial.filter(h => h.es_alerta && !h.alerta_cerrada),
    [historial]
  );

  const handleCerrarAlerta = async (historialId) => {
    const ok = await cerrarAlerta(historialId);
    if (ok) {
      fetchHistorial(unidad.id, filtroTipoId || null);
      onAlertaCerrada?.();
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={styleModal}>
        {/* Header */}
        <Typography variant="h6">Bitacora de Mantenimiento</Typography>
        <Typography variant="h5" fontWeight="bold" color="primary.main">
          {unidad?.unidad} ({unidad?.no_eco})
        </Typography>

        {alertasAbiertas.length > 0 && (
          <Alert severity="error" sx={{ mt: 1, mb: 1, fontSize: '0.83rem' }}>
            {alertasAbiertas.length} incidencia(s) abierta(s). Cierra las alertas una vez revisadas.
          </Alert>
        )}

        {/* Filtro por tipo */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5, mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Filtrar por tipo de evento</InputLabel>
            <Select
              value={filtroTipoId}
              label="Filtrar por tipo de evento"
              onChange={(e) => setFiltroTipoId(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {eventoTipos.map(t => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {filtroTipoId && (
            <Button size="small" variant="text" onClick={() => setFiltroTipoId('')}>
              Limpiar filtro
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {historial.length} registro(s)
          </Typography>
        </Stack>

        {/* Lista */}
        <Paper variant="outlined" sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : historial.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              No hay registros en la bitacora
              {filtroTipoId ? ' para el tipo seleccionado' : ' para esta unidad'}.
            </Typography>
          ) : (
            <List disablePadding>
              {historial.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <Divider sx={{ my: 1 }} />}
                  <ListItem alignItems="flex-start" sx={{ px: 0.5 }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip
                              icon={getEventoIcon(item.evento_codigo)}
                              label={item.evento_nombre}
                              color={getEventoColor(item)}
                              size="small"
                              variant={item.es_alerta && !item.alerta_cerrada ? 'filled' : 'outlined'}
                            />
                            {item.numero_requisicion && (
                              <Chip label={'REQ: ' + item.numero_requisicion} size="small" variant="outlined" color="secondary" />
                            )}
                            {item.numero_oc && (
                              <Chip label={'OC: ' + item.numero_oc} size="small" variant="outlined" />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {formatFecha(item.fecha)}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          {item.descripcion && (
                            <Typography component="span" variant="body2" color="text.primary">
                              {item.descripcion}
                            </Typography>
                          )}

                          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <Typography component="span" variant="body2" color="text.secondary">
                              KM: {formatKm(item.kilometraje)}
                            </Typography>
                            {item.costo_total > 0 && (
                              <Typography component="span" variant="body2" color="text.secondary">
                                Costo: ${parseFloat(item.costo_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </Typography>
                            )}
                            {item.numeros_serie && (
                              <Typography component="span" variant="body2" color="text.secondary">
                                Serie(s): {item.numeros_serie}
                              </Typography>
                            )}
                          </Stack>

                          <Typography component="span" variant="caption" color="text.secondary">
                            Registrado por: {item.usuario_nombre || 'Sistema'}
                          </Typography>

                          {/* Estado de alerta */}
                          {item.es_alerta && (
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                              {item.alerta_cerrada ? (
                                <Chip
                                  icon={<CheckCircleOutlineIcon />}
                                  label={'Cerrada por ' + (item.alerta_cerrada_por_nombre || 'usuario') + ' — ' + formatFecha(item.alerta_cerrada_en)}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              ) : (
                                <>
                                  <Chip
                                    icon={<WarningAmberIcon />}
                                    label="Incidencia abierta"
                                    size="small"
                                    color="error"
                                    variant="filled"
                                  />
                                  <Tooltip title="Marcar incidencia como revisada y cerrada">
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      disabled={isSubmitting}
                                      startIcon={<CheckCircleOutlineIcon />}
                                      onClick={() => handleCerrarAlerta(item.id)}
                                    >
                                      Cerrar
                                    </Button>
                                  </Tooltip>
                                </>
                              )}
                            </Stack>
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>

        <Stack direction="row" justifyContent="flex-end" sx={{ pt: 2 }}>
          <Button variant="contained" onClick={onClose}>Cerrar</Button>
        </Stack>
      </Box>
    </Modal>
  );
}
