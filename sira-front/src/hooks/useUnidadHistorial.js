// sira-front/src/hooks/useUnidadHistorial.js
import { useState, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useUnidadHistorial = () => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorial = useCallback(async (unidadId, eventoTipoId = null) => {
    if (!unidadId) return;
    setLoading(true);
    setHistorial([]);
    try {
      const params = eventoTipoId ? `?eventoTipoId=${eventoTipoId}` : '';
      const data = await api.get(`/api/unidades/${unidadId}/historial${params}`);
      setHistorial(data);
    } catch (error) {
      console.error(`Error al cargar historial para unidad ${unidadId}:`, error);
      toast.error(error?.error || 'Error al cargar la bitácora.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { historial, loading, fetchHistorial };
};
