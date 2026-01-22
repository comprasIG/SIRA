//C:\SIRA\sira-front\src\components\configuracion\GestionNotificaciones.jsx
/**
 * =================================================================================================
 * COMPONENTE: Gestión de Grupos de Notificación (Versión Final con CRUD)
 * =================================================================================================
 * @file GestionNotificaciones.jsx
 * @description Interfaz completa para crear, leer, actualizar y eliminar grupos de
 * notificación, así como para gestionar los usuarios miembros de cada grupo.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Grid, Paper, List, ListItem, ListItemButton, ListItemText, Typography, CircularProgress, Box,
  Autocomplete, TextField, Button, IconButton, Divider, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';

// --- Sub-componente: Modal para Crear/Editar Grupos ---
const GrupoFormModal = ({ open, onClose, onSave, grupo }) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [codigo, setCodigo] = useState('');
  
  useEffect(() => {
    // Rellena el formulario si estamos en modo edición
    if (grupo) {
      setNombre(grupo.nombre || '');
      setDescripcion(grupo.descripcion || '');
      setCodigo(grupo.codigo || '');
    } else {
      // Limpia el formulario si estamos en modo creación
      setNombre('');
      setDescripcion('');
      setCodigo('');
    }
  }, [grupo, open]);

  const handleSubmit = () => {
    if (!nombre || !codigo) {
      toast.error("El nombre y el código son obligatorios.");
      return;
    }
    onSave({ nombre, descripcion, codigo });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{grupo ? 'Editar Grupo' : 'Crear Nuevo Grupo'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField label="Nombre del Grupo" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth autoFocus />
        <TextField label="Código Único" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, '_'))} fullWidth disabled={!!grupo} helperText={grupo ? "El código no se puede editar." : "Ej: NOTIFICAR_COMPRAS. Sin espacios."}/>
        <TextField label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} multiline rows={2} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained">Guardar</Button>
      </DialogActions>
    </Dialog>
  );
};


// --- Componente Principal ---
export default function GestionNotificaciones() {
  // --- Estados ---
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [grupoParaEditar, setGrupoParaEditar] = useState(null);

  // --- Efectos (Carga de Datos) ---
  const fetchGrupos = useCallback(async () => {
    setLoadingGrupos(true);
    try {
      const data = await api.get('/api/configuracion/notificaciones');
      setGrupos(data);
    } catch (err) {
      toast.error('Error al cargar los grupos de notificación.');
    } finally {
      setLoadingGrupos(false);
    }
  }, []);

  useEffect(() => {
    fetchGrupos();
  }, [fetchGrupos]);

  useEffect(() => {
    if (userQuery.length < 3) {
      setUserOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/api/usuarios/search?query=${userQuery}`);
        setUserOptions(data);
      } catch (err) {
        console.error("Error buscando usuarios");
      }
    }, 500); // Debounce para no llamar a la API en cada tecla
    return () => clearTimeout(timer);
  }, [userQuery]);

  // --- Manejadores de Eventos ---
  const handleSelectGrupo = async (id) => {
    setLoadingDetalle(true);
    setGrupoActivo(null); // Limpia el detalle anterior
    try {
      const data = await api.get(`/api/configuracion/notificaciones/${id}`);
      setGrupoActivo(data);
    } catch (err) {
      toast.error('Error al cargar el detalle del grupo.');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleAddUser = async () => {
    if (!selectedUser || !grupoActivo) return;
    try {
      await api.post(`/api/configuracion/notificaciones/${grupoActivo.id}/usuarios`, {
        usuario_id: selectedUser.id,
      });
      toast.success(`${selectedUser.nombre} ha sido añadido al grupo.`);
      handleSelectGrupo(grupoActivo.id);
      setSelectedUser(null);
      setUserQuery('');
      setUserOptions([]);
    } catch (err) {
      toast.error(err.error || 'No se pudo añadir al usuario.');
    }
  };

  const handleRemoveUser = async (usuarioId) => {
    if (!grupoActivo || !window.confirm("¿Estás seguro de que quieres remover a este usuario del grupo?")) return;
    try {
      await api.del(`/api/configuracion/notificaciones/${grupoActivo.id}/usuarios/${usuarioId}`);
      toast.warn(`Usuario removido del grupo.`);
      handleSelectGrupo(grupoActivo.id);
    } catch (err) {
      toast.error(err.error || 'No se pudo remover al usuario.');
    }
  };
  
  const handleSaveGrupo = async (grupoData) => {
    try {
      if (grupoParaEditar) {
        await api.put(`/api/configuracion/notificaciones/${grupoParaEditar.id}`, grupoData);
        toast.success("Grupo actualizado correctamente.");
      } else {
        await api.post('/api/configuracion/notificaciones', grupoData);
        toast.success("Grupo creado correctamente.");
      }
      setIsModalOpen(false);
      setGrupoParaEditar(null);
      fetchGrupos();
    } catch (err) {
      toast.error(err.error || "No se pudo guardar el grupo.");
    }
  };
  
  const handleDeleteGrupo = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de que quieres ELIMINAR el grupo "${nombre}"? Esta acción no se puede deshacer.`)) {
      try {
        await api.del(`/api/configuracion/notificaciones/${id}`);
        toast.warn("Grupo eliminado.");
        setGrupoActivo(null);
        fetchGrupos();
      } catch (err) {
        toast.error(err.error || "No se pudo eliminar el grupo.");
      }
    }
  };
  
  // --- Renderizado ---
  return (
    <>
      <Paper sx={{ p: 2, m: 2 }}>
        <Typography variant="h5" gutterBottom>Gestión de Grupos de Notificación</Typography>
        <Grid container spacing={3}>
          {/* Columna Izquierda: Lista de Grupos */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">Grupos</Typography>
              <Button startIcon={<AddCircleOutlineIcon />} onClick={() => { setGrupoParaEditar(null); setIsModalOpen(true); }}>Crear</Button>
            </Box>
            {loadingGrupos ? <CircularProgress /> : (
              <List component={Paper} variant="outlined">
                {grupos.map(grupo => (
                  <ListItemButton key={grupo.id} onClick={() => handleSelectGrupo(grupo.id)} selected={grupoActivo?.id === grupo.id}>
                    <ListItemText primary={grupo.nombre} secondary={`${grupo.total_miembros} miembro(s)`} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Grid>

          {/* Columna Derecha: Detalle y Miembros del Grupo Activo */}
          <Grid item xs={12} md={8}>
            {loadingDetalle ? <div style={{textAlign: 'center'}}><CircularProgress /></div> : !grupoActivo ? (
              <Alert severity="info">Selecciona un grupo para ver sus miembros y administrarlo.</Alert>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6">{grupoActivo.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom><strong>Código:</strong> {grupoActivo.codigo}</Typography>
                    <Typography variant="body2" color="text.secondary">{grupoActivo.descripcion}</Typography>
                  </Box>
                  <Box>
                    <Tooltip title="Editar nombre y descripción"><IconButton onClick={() => { setGrupoParaEditar(grupoActivo); setIsModalOpen(true); }}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Eliminar grupo"><IconButton onClick={() => handleDeleteGrupo(grupoActivo.id, grupoActivo.nombre)}><DeleteIcon color="error" /></IconButton></Tooltip>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>Añadir Miembro</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Autocomplete sx={{ flexGrow: 1 }} options={userOptions} getOptionLabel={(option) => option.nombre} isOptionEqualToValue={(option, value) => option.id === value.id} value={selectedUser} onChange={(_, newValue) => setSelectedUser(newValue)} onInputChange={(_, newInputValue) => setUserQuery(newInputValue)} renderInput={(params) => <TextField {...params} label="Buscar usuario por nombre..." size="small" />} noOptionsText="No se encontraron usuarios" />
                  <Button variant="contained" onClick={handleAddUser} disabled={!selectedUser}>Añadir</Button>
                </Box>
                <Typography variant="subtitle1" gutterBottom>Miembros Actuales ({grupoActivo.usuarios.length})</Typography>
                <List component={Paper} variant="outlined" sx={{maxHeight: '40vh', overflow: 'auto'}}>
                  {grupoActivo.usuarios.map(user => (
                    <ListItem key={user.id} secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => handleRemoveUser(user.id)}><DeleteIcon color="action" /></IconButton>}>
                      <ListItemText primary={user.nombre} secondary={user.correo} />
                    </ListItem>
                  ))}
                  {grupoActivo.usuarios.length === 0 && <ListItem><ListItemText secondary="Este grupo no tiene miembros." /></ListItem>}
                </List>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>
      <GrupoFormModal 
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveGrupo}
        grupo={grupoParaEditar}
      />
    </>
  );
}