// C:\SIRA\sira-front\src\components\-configuracion\RolesYPermisos.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Divider, FormGroup, FormControlLabel, Checkbox,
  Button, TextField, Stack, Alert, Chip, IconButton,
  Popover, Badge, Avatar, ListItemIcon
} from '@mui/material';
import { useRolesYPermisos } from '../../hooks/useRolesYPermisos';
import { toast } from 'react-toastify';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { motion } from 'framer-motion';

import ModalMoverUsuario from './ModalMoverUsuario';

// (Helper groupFuncionesByModulo sin cambios)
const groupFuncionesByModulo = (funciones) => {
  return funciones.reduce((acc, func) => {
    const { modulo = 'General' } = func;
    if (!acc[modulo]) {
      acc[modulo] = [];
    }
    acc[modulo].push(func);
    return acc;
  }, {});
};

// (Opciones de animación sin cambios)
const popoverVariants = {
  hidden: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export default function RolesYPermisos() {
  // (Toda la lógica de hooks, estados y manejadores de eventos se queda igual)
  const {
    roles, masterFunciones, loading, isSubmitting,
    refetchDatos, crearRol, syncFunciones, cambiarRolUsuario
  } = useRolesYPermisos();

  const [selectedRol, setSelectedRol] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState(new Set());
  const [nuevoRolNombre, setNuevoRolNombre] = useState('');
  const [nuevoRolCodigo, setNuevoRolCodigo] = useState('');
  const [modalMoverState, setModalMoverState] = useState({
    open: false,
    usuario: null,
  });
  
  const [popoverState, setPopoverState] = useState({
    anchorEl: null,
    title: '',
    items: [],
  });
  const hoverTimer = useRef(null);
  const HOVER_DELAY = 300; 

  const handlePopoverOpen = (event, title, items) => {
    clearTimeout(hoverTimer.current);
    setPopoverState({
      anchorEl: event.currentTarget,
      title,
      items,
    });
  };

  const handlePopoverClose = () => {
    clearTimeout(hoverTimer.current);
    setPopoverState(prev => ({ ...prev, anchorEl: null }));
  };

  const handleDelayedOpen = (event, title, items) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      handlePopoverOpen(event, title, items);
    }, HOVER_DELAY);
  };

  const funcionesAgrupadas = useMemo(() => groupFuncionesByModulo(masterFunciones), [masterFunciones]);

  useEffect(() => {
    if (selectedRol) {
      const funcionIds = new Set(selectedRol.funciones.map(f => f.id));
      setPermisosSeleccionados(funcionIds);
    } else {
      setPermisosSeleccionados(new Set());
    }
  }, [selectedRol]);

  const handleTogglePermiso = (funcionId) => {
    const nuevosPermisos = new Set(permisosSeleccionados);
    nuevosPermisos.has(funcionId) ? nuevosPermisos.delete(funcionId) : nuevosPermisos.add(funcionId);
    setPermisosSeleccionados(nuevosPermisos);
  };

  const handleGuardarPermisos = async () => {
    if (!selectedRol) return;
    const funcionIds = Array.from(permisosSeleccionados);
    await syncFunciones(selectedRol.id, funcionIds);
  };

  const handleCrearRol = async (e) => {
    e.preventDefault();
    if (!nuevoRolNombre || !nuevoRolCodigo) return toast.error('Código y Nombre obligatorios.');
    const exito = await crearRol(nuevoRolCodigo, nuevoRolNombre);
    if (exito) {
      setNuevoRolNombre('');
      setNuevoRolCodigo('');
    }
  };

  const handleOpenMoverModal = (usuario) => setModalMoverState({ open: true, usuario: usuario });
  const handleCloseMoverModal = () => setModalMoverState({ open: false, usuario: null });
  const handleMoverUsuarioSubmit = async (usuarioId, nuevoRolId) => {
    const exito = await cambiarRolUsuario(usuarioId, nuevoRolId);
    if (exito) {
      handleCloseMoverModal();
      refetchDatos(); 
    }
    return exito;
  };
  
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  }

  const openPopover = Boolean(popoverState.anchorEl);

  return (
    <>
      {/* --- SECCIÓN 1: ENCABEZADO "CREAR ROL" (Sin cambios) --- */}
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Box component="form" onSubmit={handleCrearRol}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2}
            alignItems="center"
          >
            <Typography variant="h6" sx={{ mr: 2, flexShrink: 0 }}>Crear Nuevo Rol</Typography>
            <TextField
              label="Código de Rol (ej. VENTAS)"
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
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddIcon />}
              disabled={isSubmitting}
              sx={{ flexShrink: 0 }}
            >
              Crear
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* --- SECCIÓN 2: COLUMNAS PRINCIPALES (Layout sin cambios) --- */}
      <Grid container spacing={3}>

        {/* --- COLUMNA 1: LISTA DE ROLES (Corregido 'item' prop) --- */}
        {/* ======================================================== */}
        {/* --- ¡CORRECCIÓN! Eliminada la prop 'item={true}' --- */}
        {/* ======================================================== */}
        <Grid xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 2, height: '75vh', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>Roles del Sistema</Typography>
            <List component="nav" dense>
              {roles.map((rol) => (
                <ListItemButton
                  key={rol.id}
                  selected={selectedRol?.id === rol.id}
                  onClick={() => setSelectedRol(rol)}
                >
                  <ListItemText
                    primary={rol.nombre}
                    secondary={rol.codigo}
                  />
                  
                  <Stack 
                    direction="row" 
                    spacing={1.5}
                    onClick={(e) => e.stopPropagation()} 
                  >
                    <Chip
                      icon={<PersonIcon sx={{ fontSize: '16px' }} />}
                      label={rol.usuarios.length}
                      size="small"
                      clickable
                      onClick={(e) => handlePopoverOpen(e, 'Usuarios', rol.usuarios)}
                      onMouseEnter={(e) => handleDelayedOpen(e, 'Usuarios', rol.usuarios)}
                      // ========================================================
                      // --- ¡CORRECCIÓN! Eliminado 'onMouseLeave' de aquí ---
                      // ========================================================
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      icon={<VpnKeyIcon sx={{ fontSize: '16px' }} />}
                      label={rol.funciones.length}
                      size="small"
                      clickable
                      onClick={(e) => handlePopoverOpen(e, 'Permisos', rol.funciones)}
                      onMouseEnter={(e) => handleDelayedOpen(e, 'Permisos', rol.funciones)}
                      // ========================================================
                      // --- ¡CORRECCIÓN! Eliminado 'onMouseLeave' de aquí ---
                      // ========================================================
                      sx={{ cursor: 'pointer' }}
                    />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* --- COLUMNA 2: PERMISOS Y USUARIOS (Corregido 'item' prop) --- */}
        {/* ======================================================== */}
        {/* --- ¡CORRECCIÓN! Eliminada la prop 'item={true}' --- */}
        {/* ======================================================== */}
        <Grid xs={12} sm={8}>
          {!selectedRol ? (
            <Paper elevation={3} sx={{ p: 3, height: '75vh' }}>
              <Alert severity="info" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Selecciona un rol de la izquierda para ver y editar sus permisos.
              </Alert>
            </Paper>
          ) : (
            <Paper elevation={3} sx={{ p: 3, height: '75vh', display: 'flex', flexDirection: 'column' }}>
              {/* (Header de la Card sin cambios) */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2, flexShrink: 0 }}>
                <Box>
                  <Typography variant="h5" fontWeight="bold">{selectedRol.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary" component="div">
                    Gestionando permisos para <Chip label={selectedRol.codigo} size="small" color="primary" />
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={handleGuardarPermisos}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Permisos'}
                </Button>
              </Stack>
              
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {/* Sección de Usuarios (sin cambios) */}
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
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleOpenMoverModal(user)}
                                endIcon={<OpenInNewIcon />}
                              >
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

                {/* Sección de Permisos (sin cambios) */}
                <Alert severity="warning" sx={{ mb: 3 }}>
                  ¡Cuidado! Los cambios de permisos aquí afectan a todos los usuarios de este rol.
                </Alert>

                {Object.keys(funcionesAgrupadas).map((modulo) => (
                  <Box key={modulo} sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>{modulo}</Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <FormGroup>
                        {/* ======================================================== */}
                        {/* --- ¡CORRECCIÓN! Eliminada la prop 'item={true}' --- */}
                        {/* ======================================================== */}
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

      {/* --- MODAL MOVER USUARIO (Sin cambios) --- */}
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

      {/* --- POPOVER DE DETALLES (Sin cambios) --- */}
      <Popover
        id="rol-detalle-popover"
        open={openPopover}
        anchorEl={popoverState.anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          onMouseEnter: () => clearTimeout(hoverTimer.current),
          onMouseLeave: handlePopoverClose, // <-- Este SÍ se queda
          sx: { 
            pointerEvents: 'auto',
            borderRadius: 2, 
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 5px 15px',
            border: '1px solid rgba(0, 0, 0, 0.1)'
          }
        }}
        disableRestoreFocus
      >
        <motion.div
          initial="hidden"
          animate={openPopover ? "visible" : "hidden"}
          variants={popoverVariants}
        >
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
                <ListItemText primary={`No hay ${popoverState.title.toLowerCase()}...`} />
              )}
            </List>
          </Box>
        </motion.div>
      </Popover>
    </>
  );
}