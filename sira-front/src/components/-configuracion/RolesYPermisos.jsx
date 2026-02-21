// C:\SIRA\sira-front\src\components\-configuracion\RolesYPermisos.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Divider, FormGroup, FormControlLabel, Checkbox,
  Button, TextField, Stack, Alert, Chip, IconButton,
  Popover, Badge, Avatar, ListItemIcon,
  Tabs, Tab, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, InputAdornment,
} from '@mui/material';
import { useRolesYPermisos } from '../../hooks/useRolesYPermisos';
import { toast } from 'react-toastify';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BuildIcon from '@mui/icons-material/Build';
import { motion } from 'framer-motion';

import ModalMoverUsuario from './ModalMoverUsuario';

const groupFuncionesByModulo = (funciones) =>
  funciones.reduce((acc, func) => {
    const { modulo = 'General' } = func;
    if (!acc[modulo]) acc[modulo] = [];
    acc[modulo].push(func);
    return acc;
  }, {});

const popoverVariants = {
  hidden: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ── Panel: Acceso Flotilla ────────────────────────────────────────────────────
function PanelAccesoFlotilla({ accesoUnidades, updateAccesoUnidades, isSubmitting }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Los departamentos con "Ver todas las unidades" activado pueden ver la flotilla completa,
        independientemente de quien sea el responsable de cada unidad.
        Los demas usuarios solo ven las unidades de su departamento.
      </Alert>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Departamento</strong></TableCell>
              <TableCell><strong>Codigo</strong></TableCell>
              <TableCell align="center"><strong>Ver todas las unidades</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accesoUnidades.map((depto) => (
              <TableRow key={depto.id} hover>
                <TableCell>{depto.nombre}</TableCell>
                <TableCell>
                  <Chip label={depto.codigo} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={depto.puede_ver_todo ? 'Click para restringir acceso' : 'Click para dar acceso total'}>
                    <Switch
                      checked={depto.puede_ver_todo}
                      onChange={(e) => updateAccesoUnidades(depto.id, e.target.checked)}
                      disabled={isSubmitting}
                      color="success"
                    />
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

// ── Panel: Tipos de Evento (config) ──────────────────────────────────────────
function PanelTiposEvento({ eventoTiposConfig, updateEventoTipoConfig, isSubmitting }) {
  const [editando, setEditando] = useState(null);
  const [camposEdit, setCamposEdit] = useState({});

  const iniciarEdicion = (tipo) => {
    setEditando(tipo.id);
    setCamposEdit({
      km_intervalo:            tipo.km_intervalo || '',
      tipo_combustible_aplica: tipo.tipo_combustible_aplica || '',
      material_sku:            tipo.material_sku || '',
      genera_requisicion:      tipo.genera_requisicion,
      requiere_num_serie:      tipo.requiere_num_serie,
      activo:                  tipo.activo,
    });
  };

  const guardar = async (id) => {
    const payload = {
      ...camposEdit,
      km_intervalo: camposEdit.km_intervalo !== '' ? parseInt(camposEdit.km_intervalo, 10) : null,
    };
    const ok = await updateEventoTipoConfig(id, payload);
    if (ok) setEditando(null);
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Configura el intervalo de km, el tipo de combustible aplicable y el SKU del material para cada tipo de evento.
        Los tipos con "Genera Req." activo crean una requisicion en lugar de un registro manual.
      </Alert>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Codigo</strong></TableCell>
              <TableCell align="center"><strong>Genera Req.</strong></TableCell>
              <TableCell align="center"><strong>Req. Serie</strong></TableCell>
              <TableCell><strong>KM Intervalo</strong></TableCell>
              <TableCell><strong>Combustible</strong></TableCell>
              <TableCell><strong>SKU Material</strong></TableCell>
              <TableCell align="center"><strong>Activo</strong></TableCell>
              <TableCell align="center"><strong>Accion</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {eventoTiposConfig.map((tipo) => (
              <TableRow key={tipo.id} hover sx={{ opacity: tipo.activo ? 1 : 0.5 }}>
                <TableCell>{tipo.nombre}</TableCell>
                <TableCell>
                  <Chip label={tipo.codigo} size="small" variant="outlined" />
                </TableCell>

                {editando === tipo.id ? (
                  <>
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={camposEdit.genera_requisicion}
                        onChange={e => setCamposEdit(p => ({ ...p, genera_requisicion: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={camposEdit.requiere_num_serie}
                        onChange={e => setCamposEdit(p => ({ ...p, requiere_num_serie: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={camposEdit.km_intervalo}
                        onChange={e => setCamposEdit(p => ({ ...p, km_intervalo: e.target.value }))}
                        sx={{ width: 110 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={camposEdit.tipo_combustible_aplica}
                        onChange={e => setCamposEdit(p => ({ ...p, tipo_combustible_aplica: e.target.value }))}
                        sx={{ width: 120 }}
                        placeholder="GASOLINA / DIESEL"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={camposEdit.material_sku}
                        onChange={e => setCamposEdit(p => ({ ...p, material_sku: e.target.value }))}
                        sx={{ width: 140 }}
                        placeholder="SKU-123"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={camposEdit.activo}
                        onChange={e => setCamposEdit(p => ({ ...p, activo: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" variant="contained" onClick={() => guardar(tipo.id)} disabled={isSubmitting}>
                          {isSubmitting ? <CircularProgress size={16} /> : 'Guardar'}
                        </Button>
                        <Button size="small" variant="text" onClick={() => setEditando(null)}>X</Button>
                      </Stack>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell align="center">
                      <Chip size="small" label={tipo.genera_requisicion ? 'Si' : 'No'} color={tipo.genera_requisicion ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={tipo.requiere_num_serie ? 'Si' : 'No'} color={tipo.requiere_num_serie ? 'info' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell>{tipo.km_intervalo ? tipo.km_intervalo.toLocaleString('es-MX') + ' km' : '—'}</TableCell>
                    <TableCell>{tipo.tipo_combustible_aplica || 'Todos'}</TableCell>
                    <TableCell>{tipo.material_sku || '—'}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={tipo.activo ? 'Si' : 'No'} color={tipo.activo ? 'success' : 'error'} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" variant="outlined" onClick={() => iniciarEdicion(tipo)}>Editar</Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function RolesYPermisos() {
  const {
    roles, masterFunciones, accesoUnidades, eventoTiposConfig,
    loading, isSubmitting,
    refetchDatos, crearRol, syncFunciones, cambiarRolUsuario,
    updateAccesoUnidades, updateEventoTipoConfig,
  } = useRolesYPermisos();

  const [tabActivo, setTabActivo] = useState(0);
  const [selectedRol, setSelectedRol] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState(new Set());
  const [nuevoRolNombre, setNuevoRolNombre] = useState('');
  const [nuevoRolCodigo, setNuevoRolCodigo] = useState('');
  const [modalMoverState, setModalMoverState] = useState({ open: false, usuario: null });
  const [popoverState, setPopoverState] = useState({ anchorEl: null, title: '', items: [] });
  const hoverTimer = useRef(null);
  const HOVER_DELAY = 300;

  const handlePopoverOpen = (event, title, items) => {
    clearTimeout(hoverTimer.current);
    setPopoverState({ anchorEl: event.currentTarget, title, items });
  };
  const handlePopoverClose = () => {
    clearTimeout(hoverTimer.current);
    setPopoverState(prev => ({ ...prev, anchorEl: null }));
  };
  const handleDelayedOpen = (event, title, items) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => handlePopoverOpen(event, title, items), HOVER_DELAY);
  };

  const funcionesAgrupadas = useMemo(() => groupFuncionesByModulo(masterFunciones), [masterFunciones]);

  useEffect(() => {
    if (selectedRol) {
      setPermisosSeleccionados(new Set(selectedRol.funciones.map(f => f.id)));
    } else {
      setPermisosSeleccionados(new Set());
    }
  }, [selectedRol]);

  const handleTogglePermiso = (funcionId) => {
    const nuevos = new Set(permisosSeleccionados);
    nuevos.has(funcionId) ? nuevos.delete(funcionId) : nuevos.add(funcionId);
    setPermisosSeleccionados(nuevos);
  };

  const handleGuardarPermisos = async () => {
    if (!selectedRol) return;
    await syncFunciones(selectedRol.id, Array.from(permisosSeleccionados));
  };

  const handleCrearRol = async (e) => {
    e.preventDefault();
    if (!nuevoRolNombre || !nuevoRolCodigo) return toast.error('Codigo y Nombre obligatorios.');
    const exito = await crearRol(nuevoRolCodigo, nuevoRolNombre);
    if (exito) { setNuevoRolNombre(''); setNuevoRolCodigo(''); }
  };

  const handleOpenMoverModal = (usuario) => setModalMoverState({ open: true, usuario });
  const handleCloseMoverModal = () => setModalMoverState({ open: false, usuario: null });
  const handleMoverUsuarioSubmit = async (usuarioId, nuevoRolId) => {
    const exito = await cambiarRolUsuario(usuarioId, nuevoRolId);
    if (exito) handleCloseMoverModal();
    return exito;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  }

  const openPopover = Boolean(popoverState.anchorEl);

  return (
    <>
      {/* Tabs de navegacion */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabActivo} onChange={(_, v) => setTabActivo(v)}>
          <Tab label="Roles y Permisos" icon={<VpnKeyIcon />} iconPosition="start" />
          <Tab label="Acceso Flotilla" icon={<DirectionsCarIcon />} iconPosition="start" />
          <Tab label="Tipos de Evento" icon={<BuildIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* ── Tab 0: Roles y Permisos ─────────────────────────────────────────── */}
      {tabActivo === 0 && (
        <>
          <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
            <Box component="form" onSubmit={handleCrearRol}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <Typography variant="h6" sx={{ mr: 2, flexShrink: 0 }}>Crear Nuevo Rol</Typography>
                <TextField
                  label="Codigo de Rol (ej. VENTAS)"
                  size="small"
                  sx={{ flexGrow: 1, minWidth: '200px' }}
                  value={nuevoRolCodigo}
                  onChange={(e) => setNuevoRolCodigo(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
                <TextField
                  label="Nombre del Rol (ej. Vendedor)"
                  size="small"
                  sx={{ flexGrow: 2, minWidth: '200px' }}
                  value={nuevoRolNombre}
                  onChange={(e) => setNuevoRolNombre(e.target.value)}
                  disabled={isSubmitting}
                />
                <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={isSubmitting} sx={{ flexShrink: 0 }}>
                  Crear
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Grid container spacing={3}>
            <Grid xs={12} sm={4}>
              <Paper elevation={3} sx={{ p: 2, height: '75vh', overflowY: 'auto' }}>
                <Typography variant="h6" gutterBottom>Roles del Sistema</Typography>
                <List component="nav" dense>
                  {roles.map((rol) => (
                    <ListItemButton key={rol.id} selected={selectedRol?.id === rol.id} onClick={() => setSelectedRol(rol)}>
                      <ListItemText primary={rol.nombre} secondary={rol.codigo} />
                      <Stack direction="row" spacing={1.5} onClick={(e) => e.stopPropagation()}>
                        <Chip
                          icon={<PersonIcon sx={{ fontSize: '16px' }} />}
                          label={rol.usuarios.length}
                          size="small"
                          clickable
                          onClick={(e) => handlePopoverOpen(e, 'Usuarios', rol.usuarios)}
                          onMouseEnter={(e) => handleDelayedOpen(e, 'Usuarios', rol.usuarios)}
                          sx={{ cursor: 'pointer' }}
                        />
                        <Chip
                          icon={<VpnKeyIcon sx={{ fontSize: '16px' }} />}
                          label={rol.funciones.length}
                          size="small"
                          clickable
                          onClick={(e) => handlePopoverOpen(e, 'Permisos', rol.funciones)}
                          onMouseEnter={(e) => handleDelayedOpen(e, 'Permisos', rol.funciones)}
                          sx={{ cursor: 'pointer' }}
                        />
                      </Stack>
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid xs={12} sm={8}>
              {!selectedRol ? (
                <Paper elevation={3} sx={{ p: 3, height: '75vh' }}>
                  <Alert severity="info" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Selecciona un rol de la izquierda para ver y editar sus permisos.
                  </Alert>
                </Paper>
              ) : (
                <Paper elevation={3} sx={{ p: 3, height: '75vh', display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2, flexShrink: 0 }}>
                    <Box>
                      <Typography variant="h5" fontWeight="bold">{selectedRol.nombre}</Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Gestionando permisos para <Chip label={selectedRol.codigo} size="small" color="primary" />
                      </Typography>
                    </Box>
                    <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleGuardarPermisos} disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando...' : 'Guardar Permisos'}
                    </Button>
                  </Stack>

                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Usuarios en este Rol ({selectedRol.usuarios.length})
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto' }}>
                        {selectedRol.usuarios.length > 0 ? (
                          <List dense disablePadding>
                            {selectedRol.usuarios.map(user => (
                              <ListItem
                                key={user.id}
                                secondaryAction={
                                  <Button size="small" variant="outlined" onClick={() => handleOpenMoverModal(user)} endIcon={<OpenInNewIcon />}>
                                    Mover
                                  </Button>
                                }
                                sx={{ pr: 14 }}
                              >
                                <ListItemText primary={user.nombre} />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                            No hay usuarios asignados a este rol.
                          </Typography>
                        )}
                      </Paper>
                    </Box>

                    <Alert severity="warning" sx={{ mb: 3 }}>
                      Cuidado! Los cambios de permisos afectan a todos los usuarios de este rol.
                    </Alert>

                    {Object.keys(funcionesAgrupadas).map((modulo) => (
                      <Box key={modulo} sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>{modulo}</Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <FormGroup>
                            <Grid container spacing={1}>
                              {funcionesAgrupadas[modulo].map((funcion) => (
                                <Grid xs={12} sm={6} md={4} key={funcion.id}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={permisosSeleccionados.has(funcion.id)}
                                        onChange={() => handleTogglePermiso(funcion.id)}
                                        disabled={isSubmitting}
                                      />
                                    }
                                    label={funcion.nombre}
                                  />
                                </Grid>
                              ))}
                            </Grid>
                          </FormGroup>
                        </Paper>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </Grid>
          </Grid>
        </>
      )}

      {/* ── Tab 1: Acceso Flotilla ───────────────────────────────────────────── */}
      {tabActivo === 1 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Acceso a la Flotilla Vehicular
          </Typography>
          <PanelAccesoFlotilla
            accesoUnidades={accesoUnidades}
            updateAccesoUnidades={updateAccesoUnidades}
            isSubmitting={isSubmitting}
          />
        </Paper>
      )}

      {/* ── Tab 2: Tipos de Evento ───────────────────────────────────────────── */}
      {tabActivo === 2 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Tipos de Evento — Flotilla
          </Typography>
          <PanelTiposEvento
            eventoTiposConfig={eventoTiposConfig}
            updateEventoTipoConfig={updateEventoTipoConfig}
            isSubmitting={isSubmitting}
          />
        </Paper>
      )}

      {/* Modal mover usuario */}
      {modalMoverState.open && (
        <ModalMoverUsuario
          open={modalMoverState.open}
          onClose={handleCloseMoverModal}
          usuario={modalMoverState.usuario}
          rolActual={selectedRol}
          listaDeRoles={roles}
          onSubmit={handleMoverUsuarioSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Popover de detalles */}
      <Popover
        id="rol-detalle-popover"
        open={openPopover}
        anchorEl={popoverState.anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          onMouseEnter: () => clearTimeout(hoverTimer.current),
          onMouseLeave: handlePopoverClose,
          sx: {
            pointerEvents: 'auto',
            borderRadius: 2,
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 5px 15px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
          },
        }}
        disableRestoreFocus
      >
        <motion.div initial="hidden" animate={openPopover ? 'visible' : 'hidden'} variants={popoverVariants}>
          <Box sx={{ p: 2, maxWidth: 350 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {popoverState.title} ({popoverState.items.length})
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {popoverState.items.length > 0 ? popoverState.items.map((item, index) => (
                <ListItem key={item.id || index} disableGutters>
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                      {popoverState.title === 'Usuarios' ? item.nombre[0] : (item.modulo || 'G')[0]}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.nombre}
                    secondary={popoverState.title === 'Permisos' ? item.codigo : null}
                  />
                </ListItem>
              )) : (
                <ListItemText primary={'No hay ' + popoverState.title.toLowerCase() + '...'} />
              )}
            </List>
          </Box>
        </motion.div>
      </Popover>
    </>
  );
}
