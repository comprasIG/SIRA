// sira-front/src/hooks/useUnidades.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify'; 

export const useUnidades = () => {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Función para cargar las unidades
  const fetchUnidades = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Esta es la llamada a tu nuevo endpoint del backend
      
      // ==========================================================
      // ¡AQUÍ ESTÁ LA CORRECCIÓN!
      // Añadimos el prefijo '/api' para que coincida con app.js
      // ==========================================================
      const  data  = await api.get('/api/unidades'); 

    setUnidades(data);
    } catch (error) {
      console.error("Error al cargar unidades:", error);
      // El error 404 ahora se reportará aquí
      toast.error(error?.error || 'Error al cargar la flotilla.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar los datos la primera vez que el hook se usa
  useEffect(() => {
    fetchUnidades();
  }, [fetchUnidades]);

  // Exponemos los datos y la función de recarga
  return {
    unidades,
    loading,
    refetchUnidades: fetchUnidades,
  };
};