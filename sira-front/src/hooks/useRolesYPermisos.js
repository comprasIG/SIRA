// sira-front/src/hooks/useRolesYPermisos.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useRolesYPermisos = () => {
  const [roles, setRoles] = useState([]);
  const [masterFunciones, setMasterFunciones] = useState([]);
  const [accesoUnidades, setAccesoUnidades] = useState([]);
  const [eventoTiposConfig, setEventoTiposConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, funcionesRes, accesoRes, tiposRes] = await Promise.all([
        api.get('/api/roles'),
        api.get('/api/roles/funciones'),
        api.get('/api/roles/acceso-unidades'),
        api.get('/api/roles/evento-tipos-config'),
      ]);
      setRoles(rolesRes);
      setMasterFunciones(funcionesRes);
      setAccesoUnidades(accesoRes);
      setEventoTiposConfig(tiposRes);
    } catch (error) {
      console.error("Error al cargar datos de roles:", error);
      toast.error(error?.error || 'Error al cargar datos de configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatos(); }, [fetchDatos]);

  const crearRol = async (codigo, nombre) => {
    setIsSubmitting(true);
    try {
      await api.post('/api/roles', { codigo, nombre });
      toast.success(`Rol "${nombre}" creado con éxito.`);
      await fetchDatos();
      return true;
    } catch (error) {
      toast.error(error?.error || 'No se pudo crear el rol.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cambiarRolUsuario = async (usuarioId, nuevoRolId) => {
    setIsSubmitting(true);
    try {
      await api.put(`/api/roles/cambiar-usuario/${usuarioId}`, { nuevoRolId });
      toast.success('Usuario movido de rol.');
      await fetchDatos();
      return true;
    } catch (error) {
      toast.error(error?.error || 'No se pudo cambiar el rol del usuario.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncFunciones = async (rolId, funcionIds) => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/roles/${rolId}/sync-funciones`, { funcionIds });
      toast.success('Permisos del rol actualizados.');
      await fetchDatos();
      return true;
    } catch (error) {
      toast.error(error?.error || 'No se pudieron guardar los permisos.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAccesoUnidades = async (deptoId, puedeVerTodo) => {
    setIsSubmitting(true);
    try {
      await api.put(`/api/roles/acceso-unidades/${deptoId}`, { puede_ver_todo: puedeVerTodo });
      toast.success('Acceso a flotilla actualizado.');
      // Actualización optimista local para respuesta inmediata
      setAccesoUnidades(prev =>
        prev.map(d => d.id === deptoId ? { ...d, puede_ver_todo: puedeVerTodo } : d)
      );
      return true;
    } catch (error) {
      toast.error(error?.error || 'No se pudo actualizar el acceso.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEventoTipoConfig = async (id, campos) => {
    setIsSubmitting(true);
    try {
      await api.put(`/api/roles/evento-tipos-config/${id}`, campos);
      toast.success('Tipo de evento actualizado.');
      setEventoTiposConfig(prev =>
        prev.map(t => t.id === id ? { ...t, ...campos } : t)
      );
      return true;
    } catch (error) {
      toast.error(error?.error || 'No se pudo actualizar el tipo de evento.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    roles,
    masterFunciones,
    accesoUnidades,
    eventoTiposConfig,
    loading,
    isSubmitting,
    refetchDatos: fetchDatos,
    crearRol,
    cambiarRolUsuario,
    syncFunciones,
    updateAccesoUnidades,
    updateEventoTipoConfig,
  };
};
