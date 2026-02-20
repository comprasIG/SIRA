// src/hooks/useHitosDashboard.js
/**
 * Hook para el tab "TO DO" (KPI de Hitos) en los dashboards departamentales.
 *
 * Carga los hitos con responsable asignado, calcula KPIs y provee
 * filtros en cascada por departamento, estado, proyecto y responsable.
 *
 * Por default muestra solo los hitos del departamento del usuario autenticado.
 * El filtro `departamento` permite ver los de otro depto o todos.
 */

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { AuthContext } from '../context/authContext';
import api from '../api/api';

const DEFAULT_FILTERS = {
  search: '',
  estado: '',       // PENDIENTE | VENCIDO | REALIZADO | ''
  departamento: '', // nombre del departamento (vacío = propio del usuario)
  proyecto: '',
  responsable: '',
  showAll: false,   // true = todos los deptos; false = solo el filtrado
  includeDone: false,
};

function uniqSorted(arr) {
  return [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function applyFilters(data, filters, exclude) {
  let out = data;

  if (filters.search && exclude !== 'search') {
    const q = filters.search.toLowerCase();
    out = out.filter(
      (h) =>
        (h.nombre || '').toLowerCase().includes(q) ||
        (h.proyecto_nombre || '').toLowerCase().includes(q) ||
        (h.responsable_nombre || '').toLowerCase().includes(q)
    );
  }

  if (filters.estado && exclude !== 'estado') {
    out = out.filter((h) => h.estado === filters.estado);
  }

  if (filters.departamento && exclude !== 'departamento') {
    out = out.filter((h) => (h.departamento_nombre || '') === filters.departamento);
  }

  if (filters.proyecto && exclude !== 'proyecto') {
    out = out.filter((h) => (h.proyecto_nombre || '') === filters.proyecto);
  }

  if (filters.responsable && exclude !== 'responsable') {
    out = out.filter((h) => (h.responsable_nombre || '') === filters.responsable);
  }

  return out;
}

export function useHitosDashboard() {
  const { usuario } = useContext(AuthContext) || {};

  const [allHitos, setAllHitos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
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
      const params = new URLSearchParams();

      if (filters.showAll) {
        params.append('all_depts', 'true');
      } else if (filters.departamento) {
        // Enviar el id del departamento seleccionado
        const dept = departamentos.find((d) => d.nombre === filters.departamento);
        if (dept) params.append('departamento_id', String(dept.id));
      } else if (usuario?.departamento_id) {
        params.append('departamento_id', String(usuario.departamento_id));
      }

      if (filters.includeDone) {
        params.append('include_done', 'true');
      }

      const url = `/api/dashboard/hitos?${params.toString()}`;
      const data = await api.get(url);

      setAllHitos(Array.isArray(data.hitos) ? data.hitos : []);
      if (Array.isArray(data.departamentos)) setDepartamentos(data.departamentos);
    } catch (err) {
      console.error(err);
      setError(err?.error || err?.message || 'Error al cargar hitos.');
      setAllHitos([]);
    } finally {
      setLoading(false);
    }
  }, [usuario?.departamento_id, filters.showAll, filters.includeDone, filters.departamento, departamentos]);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.departamento_id, filters.showAll, filters.includeDone]);

  // Re-fetch cuando cambia el filtro de departamento (enviamos al backend)
  useEffect(() => {
    // Solo re-fetch si ya cargamos al menos una vez (departamentos ya disponibles)
    if (departamentos.length > 0 || filters.departamento === '') {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.departamento]);

  // Lista completamente filtrada (filtros de UI)
  const filtered = useMemo(
    () => applyFilters(allHitos, filters),
    [allHitos, filters]
  );

  // Opciones en cascada
  const estadoOptions = useMemo(
    () => ['', 'PENDIENTE', 'VENCIDO', 'REALIZADO'],
    []
  );

  const departamentoOptions = useMemo(
    () => [''].concat(uniqSorted(applyFilters(allHitos, filters, 'departamento').map((h) => h.departamento_nombre))),
    [allHitos, filters]
  );

  const proyectoOptions = useMemo(
    () => [''].concat(uniqSorted(applyFilters(allHitos, filters, 'proyecto').map((h) => h.proyecto_nombre))),
    [allHitos, filters]
  );

  const responsableOptions = useMemo(
    () => [''].concat(uniqSorted(applyFilters(allHitos, filters, 'responsable').map((h) => h.responsable_nombre))),
    [allHitos, filters]
  );

  // KPIs (sobre el dataset filtrado)
  const kpis = useMemo(() => ({
    total: filtered.length,
    pendientes: filtered.filter((h) => h.estado === 'PENDIENTE').length,
    vencidos: filtered.filter((h) => h.estado === 'VENCIDO').length,
    realizados: filtered.filter((h) => h.estado === 'REALIZADO').length,
  }), [filtered]);

  const marcarRealizado = useCallback(async (id) => {
    await api.patch(`/api/dashboard/hitos/${id}/realizado`, {});
    loadData();
  }, [loadData]);

  const marcarPendiente = useCallback(async (id) => {
    await api.patch(`/api/dashboard/hitos/${id}/pendiente`, {});
    loadData();
  }, [loadData]);

  return {
    loading,
    error,
    hitos: filtered,
    kpis,
    filters,
    estadoOptions,
    departamentoOptions,
    proyectoOptions,
    responsableOptions,
    departamentos,
    setFilter,
    resetFilters,
    reload: loadData,
    marcarRealizado,
    marcarPendiente,
  };
}
