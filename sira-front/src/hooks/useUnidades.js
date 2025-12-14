// sira-front/src/hooks/useUnidades.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce'; // Importamos debounce

// Estado inicial de los filtros
const initialFilters = {
  departamentoId: '',
  marca: '',
  status: '',
};

export const useUnidades = () => {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ¡NUEVO! Estados para los filtros ---
  const [filters, setFilters] = useState(initialFilters);
  const [filterOptions, setFilterOptions] = useState({ marcas: [], departamentos: [] });
  // ----------------------------------------

  // --- ¡NUEVA! Función para cargar las opciones de los filtros ---
  const fetchFilterData = useCallback(async () => {
    try {
      const data = await api.get('/api/unidades/datos-filtros');
      setFilterOptions(data);
    } catch (error) {
      console.error("Error al cargar datos de filtros:", error);
      toast.error(error?.error || 'Error al cargar opciones de filtros.');
    }
  }, []);
  // -----------------------------------------------------------

  // --- ¡MODIFICADA! Ahora acepta filtros y los envía a la API ---
  const fetchUnidades = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      // Limpiamos filtros vacíos (ej. { marca: '', status: 'DISPONIBLE' })
      const cleanFilters = Object.fromEntries(
        Object.entries(currentFilters).filter(([, v]) => v != null && v !== '')
      );
      // Convertimos a query string (ej. "?status=DISPONIBLE")
      const queryParams = new URLSearchParams(cleanFilters).toString();
      
      const data = await api.get(`/api/unidades?${queryParams}`);
      setUnidades(data);
    } catch (error) {
      console.error("Error al cargar unidades:", error);
      toast.error(error?.error || 'Error al cargar la flotilla.');
    } finally {
      setLoading(false);
    }
  }, []);
  // -------------------------------------------------------------

  // --- ¡NUEVO! Hook de debounce (igual que en useRecoleccion) ---
  // Esto espera 400ms después de que el usuario deja de escribir/seleccionar
  // antes de lanzar la llamada a la API.
  const debouncedFetch = useCallback(debounce(fetchUnidades, 400), [fetchUnidades]);
  
  // --- ¡MODIFICADO! useEffects para la carga inicial y los filtros ---
  useEffect(() => {
    // Carga las opciones de los filtros (Marcas, Deptos) solo una vez
    fetchFilterData();
  }, [fetchFilterData]);

  useEffect(() => {
    // Vuelve a llamar a la API (con debounce) cada vez que los 'filters' cambian
    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);
  // -----------------------------------------------------------------

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  // Exponemos los nuevos estados y funciones
  return {
    unidades,
    loading,
    refetchUnidades: () => fetchUnidades(filters), // 'refetch' usa los filtros actuales
    filters,
    setFilters,
    filterOptions,
    resetFilters,
  };
};