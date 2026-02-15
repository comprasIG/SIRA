import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';

const INITIAL_FILTERS = {
    search: '',
    status: 'ABIERTAS', // 'ABIERTAS' | 'TODAS' | specific status
    proyecto: '',
    sitio: '',
    proveedor: '',
    fechaInicio: '',
    fechaFin: '',
    sort_by: 'numero_oc_desc', // 'numero_oc_desc' | 'fecha_desc' | 'fecha_asc'
};

export const useG_OC = () => {
    const [ocs, setOcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [kpis, setKpis] = useState({
        total: 0,
        abiertas: 0,
        porAutorizar: 0,
        entregadas: 0,
        rechazadas: 0
    });

    // Options for select inputs
    const [options, setOptions] = useState({
        proyectos: [],
        sitios: [],
        proveedores: [],
        status: []
    });

    const fetchOptions = useCallback(async (currentStatus) => {
        try {
            const params = new URLSearchParams();
            if (currentStatus === 'ABIERTAS') {
                params.append('exclude_status', 'ENTREGADA,RECHAZADA,CANCELADA');
            } else if (currentStatus && currentStatus !== 'TODAS') {
                params.append('status', currentStatus);
            }

            const data = await api.get(`/api/ocs/filters?${params.toString()}`);
            if (data) {
                setOptions(prev => ({
                    ...prev,
                    proyectos: data.proyectos || [],
                    sitios: data.sitios || [],
                    status: data.status || ['ABIERTAS', 'POR_AUTORIZAR', 'AUTORIZADA', 'ENTREGADA', 'RECHAZADA', 'CANCELADA', 'HOLD']
                }));
            }
        } catch (error) {
            console.error("Error fetching options", error);
        }
    }, []);


    // Fetch OCs with filters
    const fetchOCs = useCallback(async (currentFilters) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            // Handle "ABIERTAS" logic (default view)
            if (currentFilters.status === 'ABIERTAS') {
                // We want everything EXCEPT ENTREGADA and RECHAZADA (and maybe CANCELADA)
                params.append('exclude_status', 'ENTREGADA,RECHAZADA,CANCELADA');
            } else if (currentFilters.status && currentFilters.status !== 'TODAS') {
                params.append('status', currentFilters.status);
            }

            if (currentFilters.search) params.append('search', currentFilters.search);
            if (currentFilters.proyecto) params.append('proyecto', currentFilters.proyecto);
            if (currentFilters.sitio) params.append('sitio', currentFilters.sitio);
            if (currentFilters.proveedor) params.append('proveedor', currentFilters.proveedor);
            if (currentFilters.fechaInicio) params.append('fecha_inicio', currentFilters.fechaInicio);
            if (currentFilters.fechaFin) params.append('fecha_fin', currentFilters.fechaFin);
            if (currentFilters.sort_by) params.append('sort_by', currentFilters.sort_by);

            // Updated to use the correct endpoint implemented in backend
            const data = await api.get(`/api/ocs?${params.toString()}`);

            // If the endpoint returns { data: [], kpis: {} } structure
            if (data.ocs) {
                setOcs(data.ocs);
                setKpis(prev => ({ ...prev, ...data.kpis })); // Merge if backend provides calculated KPIs
            } else if (Array.isArray(data)) {
                setOcs(data);
                // Calculate KPIs frontend-side if backend doesn't provide them
                const stats = data.reduce((acc, oc) => {
                    acc.total++;
                    if (['ENTREGADA'].includes(oc.status)) acc.entregadas++;
                    if (['RECHAZADA', 'CANCELADA'].includes(oc.status)) acc.rechazadas++;
                    if (['POR_AUTORIZAR'].includes(oc.status)) acc.porAutorizar++;
                    if (!['ENTREGADA', 'RECHAZADA', 'CANCELADA'].includes(oc.status)) acc.abiertas++;
                    return acc;
                }, { total: 0, abiertas: 0, porAutorizar: 0, entregadas: 0, rechazadas: 0 });
                setKpis(stats);
            }

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar las órdenes de compra.');
            setOcs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetch = useCallback(debounce((filters) => {
        fetchOCs(filters);
    }, 500), [fetchOCs]);

    useEffect(() => {
        fetchOptions(filters.status);
    }, [fetchOptions, filters.status]);

    useEffect(() => {
        // Initial fetch
        fetchOCs(filters);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        debouncedFetch(filters);
        return () => debouncedFetch.cancel();
    }, [filters, debouncedFetch]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            // Reset dependent filters if status changes
            if (name === 'status') {
                newFilters.proyecto = '';
                newFilters.sitio = '';
            }
            // Reset site if project changes? Optional, but user asked for dependency.
            // "sitio y proyecto deben ser dependientes" -> implies Project -> Site dependency
            if (name === 'proyecto') {
                newFilters.sitio = '';
            }
            return newFilters;
        });
    };

    const resetFilters = () => {
        setFilters(INITIAL_FILTERS);
    };

    return {
        ocs,
        loading,
        kpis,
        filters,
        options,
        handleFilterChange,
        resetFilters,
        refresh: () => fetchOCs(filters)
    };
};
