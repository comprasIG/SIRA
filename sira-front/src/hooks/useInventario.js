// sira-front/src/hooks/useInventario.js
import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';

const initialFilters = {
    estado: 'TODOS', // TODOS, DISPONIBLE, APARTADO
    sitioId: '',
    proyectoId: '',
    search: '',
};

export const useInventario = () => {
    const [inventario, setInventario] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState({ disponible: 0, apartado: 0, skus: 0 }); // Placeholder
    const [filters, setFilters] = useState(initialFilters);
    const [filterOptions, setFilterOptions] = useState({ sitios: [], proyectos: [] });
    const [isSubmittingAction, setIsSubmittingAction] = useState(false); // Para modales de acción

    // Carga inicial (filtros) y recarga de KPIs (estimados por ahora)
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [filterData, /* kpiData */] = await Promise.all([
                api.get('/api/inventario/datos-filtros'),
                // Podríamos tener un endpoint /api/inventario/kpis si el cálculo es pesado
                // Por ahora, los KPIs se derivarán de la lista principal
            ]);
            setFilterOptions(filterData || { sitios: [], proyectos: [] });
            // Carga inicial de la lista
            await fetchInventario(initialFilters);
        } catch (error) {
            toast.error('Error al cargar datos iniciales del inventario.');
            setLoading(false);
        }
        // setLoading(false) se maneja en fetchInventario
    }, []); // Sin dependencias para que se ejecute solo al montar

    // Función para buscar la lista de inventario
    const fetchInventario = useCallback(async (currentFilters) => {
        // setLoading(true); // Se maneja fuera o con debounce
        try {
            const cleanFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(([, v]) => v != null && v !== '')
            );
            const queryParams = new URLSearchParams(cleanFilters).toString();
            const data = await api.get(`/api/inventario?${queryParams}`);
            setInventario(data || []);
            // Calcular KPIs básicos desde la data (simplificado)
            const skus = new Set(data.map(item => item.material_id)).size;
            setKpis(prev => ({ ...prev, skus })); // Actualiza solo SKUs por ahora
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
        // Evita llamar en la carga inicial si fetchInitialData ya lo hizo
        const isInitial = JSON.stringify(filters) === JSON.stringify(initialFilters);
         if (!isInitial && !loading) { // No buscar si ya está cargando
            debouncedFetch(filters);
         }
        return () => debouncedFetch.cancel();
    }, [filters, debouncedFetch, loading]); // Añadido loading a dependencias

    const resetFilters = () => {
        setFilters(initialFilters);
        // fetchInventario(initialFilters); // El useEffect se encargará
    };

    // --- Funciones para Acciones ---

    const getDetalleAsignaciones = async (materialId) => {
        try {
            const data = await api.get(`/api/inventario/material/${materialId}/asignaciones`);
            return data || [];
        } catch (error) {
            toast.error('Error al obtener detalle de asignaciones.');
            return [];
        }
    };

    const apartarStock = async (payload) => {
        setIsSubmittingAction(true);
        try {
            const response = await api.post('/api/inventario/apartar', payload);
            toast.success(response.mensaje || 'Material apartado con éxito.');
            fetchInitialData(); // Recarga todo para reflejar cambios
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
            fetchInitialData(); // Recarga todo
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