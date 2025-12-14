// sira-front/src/hooks/useRecoleccion.js
import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';

const initialFilters = {
    proveedorId: '',
    sitioId: '',
    proyectoId: '',
    search: '',
};

export const useRecoleccion = () => {
  const [ocsAprobadas, setOcsAprobadas] = useState([]);
  const [ocsEnProceso, setOcsEnProceso] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ pendientes: 0, enRecoleccion: 0 });
  
  const [filters, setFilters] = useState(initialFilters);
  // --- ESTA ES LA LÍNEA QUE PROBABLEMENTE FALTABA ---
  const [filterOptions, setFilterOptions] = useState({ proveedores: [], sitios: [], proyectos: [], departamentos: [] });

  const fetchFilterData = useCallback(async () => {
      try {
          const data = await api.get('/api/recoleccion/datos-filtros');
          setFilterOptions(data);
      } catch {
          toast.error("No se pudieron cargar las opciones de filtro.");
      }
  }, []);

  const fetchKpis = useCallback(async () => {
    try {
      const data = await api.get('/api/recoleccion/kpis');
      setKpis(data);
    } catch {
      // Silencioso para no molestar al usuario
    }
  }, []);

  const fetchOcsAprobadas = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(currentFilters).filter(([, v]) => v != null && v !== '')
      );
      const queryParams = new URLSearchParams(cleanFilters).toString();
      const data = await api.get(`/api/recoleccion/ocs-aprobadas?${queryParams}`);
      setOcsAprobadas(data || []);
    } catch (error) {
      toast.error('Error al cargar las órdenes de compra.');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const debouncedFetch = useCallback(debounce(fetchOcsAprobadas, 400), [fetchOcsAprobadas]);
  
  useEffect(() => {
    fetchKpis();
    fetchFilterData();
  }, [fetchKpis, fetchFilterData]);

  useEffect(() => {
    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);
  
  const refreshAll = () => {
      fetchKpis();
      fetchOcsAprobadas(filters);
  };

  const procesarOC = async (ocId, data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
        if (key !== 'evidencias') formData.append(key, data[key]);
    });
    if (data.evidencias) {
        for (let i = 0; i < data.evidencias.length; i++) {
            formData.append('evidencias', data.evidencias[i]);
        }
    }
    
    try {
      await api.post(`/api/recoleccion/ocs/${ocId}/procesar`, formData);
      toast.success('OC enviada a recolección (EN PROCESO).');
      refreshAll();
    } catch (error) {
      toast.error(error?.error || 'No se pudo procesar la OC.');
      throw error;
    }
  };

  const cancelarOC = async (ocId, motivo) => {
    try {
      await api.post(`/api/recoleccion/ocs/cancelar`, { id: ocId, motivo });
      toast.warn('La OC ha sido cancelada.');
      refreshAll();
    } catch (error) {
      toast.error(error?.error || 'No se pudo cancelar la OC.');
      throw error;
    }
  };

  const fetchOcsEnProcesoList = async () => {
    try {
        const data = await api.get('/api/recoleccion/ocs-en-proceso');
        setOcsEnProceso(data);
    } catch {
        toast.error("No se pudo cargar la lista de OCs en proceso.");
    }
  };

  const resetFilters = () => {
      setFilters(initialFilters);
  };
// ===============================================
  // --- ¡NUEVA FUNCIÓN! ---
  // ===============================================
  /**
   * @description Llama al endpoint para cerrar una OC vehicular.
   */
  const cerrarOCVehicular = async (ocId, payload) => {
    try {
      // Llama al nuevo endpoint que creamos en el backend
      const data = await api.post(`/api/recoleccion/ocs/${ocId}/cerrar-vehicular`, payload);
      toast.success(data.mensaje || 'Servicio cerrado y registrado en bitácora.');
      refreshAll(); // Refresca las listas de KPIs y OCs
      return true; // Éxito
    } catch (error) {
      console.error("Error al cerrar OC vehicular:", error);
      toast.error(error?.error || 'No se pudo cerrar el servicio.');
      throw error; // Lanza el error para que el modal sepa que falló
    }
  };
  // ===============================================

  return {
    ocsAprobadas, ocsEnProceso,
    loading, kpis, filters, setFilters, filterOptions,
    procesarOC, cancelarOC, fetchOcsEnProcesoList,
    resetFilters,
    cerrarOCVehicular, // <<< EXPORTAMOS LA NUEVA FUNCIÓN
  };
};