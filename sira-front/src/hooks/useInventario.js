// sira-front/src/hooks/useInventario.js
import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';

const initialFilters = {
    estado: 'TODOS',
    sitioId: '',
    proyectoId: '',
    search: '',
};

// --- ESTADO INICIAL DE KPIs ACTUALIZADO ---
const initialKpis = {
    kpi_skus: 0,
    valores_disponibles: [], // Ahora es un array
    valores_apartados: [],   // Ahora es un array
};

export const useInventario = () => {
    const [inventario, setInventario] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState(initialKpis); // Usa el estado inicial
    const [filters, setFilters] = useState(initialFilters);
    const [filterOptions, setFilterOptions] = useState({
        sitios: [],
        proyectos: [],
        todosSitios: [],
        todosProyectos: [],
    });
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Carga inicial (filtros) y recarga de KPIs
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            // Llama al nuevo endpoint que agrupa KPIs y filtros
            const data = await api.get('/api/inventario/datos-iniciales');
            setFilterOptions({
                sitios: data.filterOptions?.sitios || [],
                proyectos: data.filterOptions?.proyectos || [],
                todosSitios: data.filterOptions?.todosSitios || [],
                todosProyectos: data.filterOptions?.todosProyectos || [],
            });
            setKpis(data.kpis || initialKpis); // Guarda la nueva estructura de KPIs
            
            // Carga inicial de la lista
            await fetchInventario(initialFilters);
        } catch (error) {
            toast.error('Error al cargar datos iniciales del inventario.');
            setLoading(false);
        }
        // setLoading(false) se maneja en fetchInventario
    }, []); // No necesita dependencias, solo se llama al montar

    // Función para buscar la lista de inventario
    const fetchInventario = useCallback(async (currentFilters) => {
        try {
            const cleanFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(([, v]) => v != null && v !== '')
            );
            const queryParams = new URLSearchParams(cleanFilters).toString();
            const data = await api.get(`/api/inventario?${queryParams}`);
            setInventario(data || []);
        } catch (error) {
            toast.error('Error al cargar la lista de inventario.');
            setInventario([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce para la búsqueda y filtros
    const debouncedFetch = useCallback(debounce((currentFilters) => {
        setLoading(true);
        fetchInventario(currentFilters);
    }, 500), [fetchInventario]);

    // Efecto para cargar datos iniciales al montar
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Efecto para reaccionar a cambios en filtros
    useEffect(() => {
        const isInitial = JSON.stringify(filters) === JSON.stringify(initialFilters);
         if (!isInitial && !loading) {
            debouncedFetch(filters);
         }
        return () => debouncedFetch.cancel();
    }, [filters, debouncedFetch, loading]);

    const resetFilters = () => {
        setFilters(initialFilters);
    };

    const getDetalleAsignaciones = async (materialId) => {
        try {
            const data = await api.get(`/api/inventario/material/${materialId}/asignaciones`);
            return data || [];
        } catch (error) {
            toast.error('Error al obtener detalle de asignaciones.');
            return [];
        }
    };

    // Lógica para recargar KPIs y filtros después de una acción
    const refreshData = async () => {
         setLoading(true);
         try {
            // Recarga solo KPIs y filtros, luego la lista de inventario
            const data = await api.get('/api/inventario/datos-iniciales');
            setFilterOptions(data.filterOptions || { sitios: [], proyectos: [], todosSitios: [], todosProyectos: [] });
            setKpis(data.kpis || initialKpis);
            await fetchInventario(filters); // Vuelve a cargar la lista con los filtros actuales
         } catch (error) {
             toast.error('Error al refrescar los datos.');
             setLoading(false);
         }
    };

    const apartarStock = async (payload) => {
        setIsSubmittingAction(true);
        try {
            const response = await api.post('/api/inventario/apartar', payload);
            toast.success(response.mensaje || 'Material apartado con éxito.');
            await refreshData(); // Recarga todo para reflejar cambios
            return true;
        } catch (error) {
            toast.error(error?.error || 'Error al apartar material.');
            return false;
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const moverAsignacion = async (payload) => {
        setIsSubmittingAction(true);
        try {
            const response = await api.post('/api/inventario/mover-asignacion', payload);
            toast.success(response.mensaje || 'Asignación movida con éxito.');
            await refreshData(); // Recarga todo
            return true;
        } catch (error) {
            toast.error(error?.error || 'Error al mover asignación.');
            return false;
        } finally {
            setIsSubmittingAction(false);
        }
    };

    return {
        inventario,
        loading,
        kpis,
        filters,
        setFilters,
        filterOptions,
        resetFilters,
        getDetalleAsignaciones,
        apartarStock,
        moverAsignacion,
        isSubmittingAction,
    };
};