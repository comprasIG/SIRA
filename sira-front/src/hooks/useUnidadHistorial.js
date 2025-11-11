// sira-front/src/hooks/useUnidadHistorial.js
import { useState, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useUnidadHistorial = () => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Función para cargar el historial de una unidad específica
  // ======== ¡CAMBIO! Renombramos 'unidadId' a 'idParaBuscar' ========
  const fetchHistorial = useCallback(async (idParaBuscar) => {
    if (!idParaBuscar) return;
    
    setLoading(true);
    setHistorial([]); // Limpiamos el historial anterior
    try {
      // ======== ¡CAMBIO! Usamos la nueva variable ========
      const data = await api.get(`/api/unidades/${idParaBuscar}/historial`);
      setHistorial(data);
    } catch (error) {
      console.error(`Error al cargar historial para ID ${idParaBuscar}:`, error);
      toast.error(error?.error || 'Error al cargar la bitácora.');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    historial,
    loading,
    fetchHistorial, // Exponemos la función para que el modal la llame
  };
};