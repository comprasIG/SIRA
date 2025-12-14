// sira-front/src/hooks/useRolesYPermisos.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api'; // (Importamos tu wrapper de API)
import { toast } from 'react-toastify'; // (Usamos react-toastify)

export const useRolesYPermisos = () => {
  const [roles, setRoles] = useState([]);
  const [masterFunciones, setMasterFunciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Carga todos los datos iniciales (roles, usuarios, permisos, etc.)
  const fetchDatos = useCallback(async () => {
    setLoading(true);
    try {
      // Hacemos ambas llamadas a la API en paralelo
      const [rolesRes, funcionesRes] = await Promise.all([
        api.get('/api/roles'), // Endpoint GET /api/roles (getRolesConDetalle)
        api.get('/api/roles/funciones') // Endpoint GET /api/roles/funciones (getAllFunciones)
      ]);
      
      setRoles(rolesRes);
      setMasterFunciones(funcionesRes);

    } catch (error) {
      console.error("Error al cargar datos de roles:", error);
      toast.error(error?.error || 'Error al cargar datos de configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Ejecutar la carga al iniciar el hook
  useEffect(() => {
    fetchDatos();
  }, [fetchDatos]);

  // 3. Función de Acción: Crear un nuevo rol
  const crearRol = async (codigo, nombre) => {
    setIsSubmitting(true);
    try {
      await api.post('/api/roles', { codigo, nombre });
      toast.success(`Rol "${nombre}" creado con éxito.`);
      await fetchDatos(); // Recargamos todo
      return true;
    } catch (error) {
      console.error("Error al crear rol:", error);
      toast.error(error?.error || 'No se pudo crear el rol.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Función de Acción: Cambiar el rol de un usuario
  const cambiarRolUsuario = async (usuarioId, nuevoRolId) => {
    setIsSubmitting(true);
    try {
      await api.put(`/api/roles/cambiar-usuario/${usuarioId}`, { nuevoRolId });
      toast.success('Usuario movido de rol.');
      await fetchDatos(); // Recargamos todo
      return true;
    } catch (error) {
      console.error("Error al cambiar rol de usuario:", error);
      toast.error(error?.error || 'No se pudo cambiar el rol del usuario.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Función de Acción: Sincronizar permisos de un rol
  const syncFunciones = async (rolId, funcionIds) => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/roles/${rolId}/sync-funciones`, { funcionIds });
      toast.success('Permisos del rol actualizados.');
      await fetchDatos(); // Recargamos todo
      return true;
    } catch (error) {
      console.error("Error al sincronizar permisos:", error);
      toast.error(error?.error || 'No se pudieron guardar los permisos.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // Datos
    roles,
    masterFunciones,
    // Estados
    loading,
    isSubmitting,
    // Acciones
    refetchDatos: fetchDatos,
    crearRol,
    cambiarRolUsuario,
    syncFunciones,
  };
};