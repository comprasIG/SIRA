// C:\SIRA\sira-front\src\hooks\useProyectosDashboard.js
/**
 * Hook for the Proyectos tab in department dashboards.
 * Loads projects with spending by currency, computes KPIs, and provides
 * cascading interdependent filters (search, status, sitio, proyecto, cliente,
 * responsable, departamento). All dropdown options update based on the currently
 * filtered dataset so they stay contextually relevant.
 */

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { AuthContext } from '../context/authContext';
import api from '../api/api';

const DEFAULT_FILTERS = {
    search: '',
    status: 'ABIERTOS',
    sitio: '',
    proyecto: '',
    cliente: '',
    responsable: '',
    departamento: '',
};

function uniqSorted(arr) {
    return [...new Set((arr || []).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
    );
}

/**
 * Apply all filters EXCEPT the one named `exclude` so that the dropdown options
 * for that field reflect everything available given the other active filters.
 */
function applyFilters(data, filters, exclude) {
    let out = data;

    // Text search (always applied, never excluded)
    if (filters.search && exclude !== 'search') {
        const q = filters.search.toLowerCase();
        out = out.filter(
            (p) =>
                (p.nombre || '').toLowerCase().includes(q) ||
                (p.sitio_nombre || '').toLowerCase().includes(q) ||
                (p.responsable_nombre || '').toLowerCase().includes(q)
        );
    }

    if (filters.status && exclude !== 'status') {
        if (filters.status === 'ABIERTOS') {
            out = out.filter((p) => p.status !== 'CANCELADO' && p.status !== 'CERRADO');
        } else {
            out = out.filter((p) => p.status === filters.status);
        }
    }
    if (filters.sitio && exclude !== 'sitio') {
        out = out.filter((p) => (p.sitio_nombre || '') === filters.sitio);
    }
    if (filters.proyecto && exclude !== 'proyecto') {
        out = out.filter((p) => (p.nombre || '') === filters.proyecto);
    }
    if (filters.cliente && exclude !== 'cliente') {
        out = out.filter((p) => (p.cliente_nombre || '') === filters.cliente);
    }
    if (filters.responsable && exclude !== 'responsable') {
        out = out.filter((p) => (p.responsable_nombre || '') === filters.responsable);
    }
    if (filters.departamento && exclude !== 'departamento') {
        out = out.filter((p) => (p.departamento_nombre || '') === filters.departamento);
    }

    return out;
}

export function useProyectosDashboard(mode) {
    const { usuario } = useContext(AuthContext) || {};

    const [allProyectos, setAllProyectos] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFiltersState] = useState(DEFAULT_FILTERS);

    const setFilter = useCallback((name, value) => {
        setFiltersState((prev) => ({ ...prev, [name]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setFiltersState(DEFAULT_FILTERS);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get('/api/dashboard/proyectos');
            setAllProyectos(Array.isArray(data.proyectos) ? data.proyectos : []);
            setStatusOptions(Array.isArray(data.statusOptions) ? data.statusOptions : []);
        } catch (err) {
            console.error(err);
            setError(err?.error || err?.message || 'Error al cargar proyectos.');
            setAllProyectos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData, mode]);

    // ---- Fully filtered list (all filters applied) ----
    const filtered = useMemo(
        () => applyFilters(allProyectos, filters),
        [allProyectos, filters]
    );

    // ---- Cascading dropdown options ----
    // Each dropdown's available options are derived from the data filtered by
    // ALL OTHER filters, so they always show contextually valid choices.

    const sitioOptions = useMemo(
        () => [''].concat(uniqSorted(applyFilters(allProyectos, filters, 'sitio').map((p) => p.sitio_nombre))),
        [allProyectos, filters]
    );

    const proyectoOptions = useMemo(
        () => [''].concat(uniqSorted(applyFilters(allProyectos, filters, 'proyecto').map((p) => p.nombre))),
        [allProyectos, filters]
    );

    const clienteOptions = useMemo(
        () => [''].concat(uniqSorted(applyFilters(allProyectos, filters, 'cliente').map((p) => p.cliente_nombre))),
        [allProyectos, filters]
    );

    const responsableOptions = useMemo(
        () => [''].concat(uniqSorted(applyFilters(allProyectos, filters, 'responsable').map((p) => p.responsable_nombre))),
        [allProyectos, filters]
    );

    const departamentoOptions = useMemo(
        () => [''].concat(uniqSorted(applyFilters(allProyectos, filters, 'departamento').map((p) => p.departamento_nombre))),
        [allProyectos, filters]
    );

    // KPIs computed from the fully filtered set
    const kpis = useMemo(() => ({
        total: filtered.length,
        enEjecucion: filtered.filter((p) => p.status === 'EN_EJECUCION').length,
        porAprobar: filtered.filter((p) => p.status === 'POR_APROBAR').length,
        cerrados: filtered.filter((p) => p.status === 'CERRADO').length,
        cancelados: filtered.filter((p) => p.status === 'CANCELADO').length,
    }), [filtered]);

    const updateStatus = useCallback(
        async (id, newStatus) => {
            await api.patch(`/api/dashboard/proyectos/${id}/status`, { status: newStatus });
            loadData();
        },
        [loadData]
    );

    return {
        loading,
        error,
        proyectos: filtered,
        kpis,
        filters,
        statusOptions,
        sitioOptions,
        proyectoOptions,
        clienteOptions,
        responsableOptions,
        departamentoOptions,
        setFilter,
        resetFilters,
        updateStatus,
        reload: loadData,
    };
}
