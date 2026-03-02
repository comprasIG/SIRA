// src/hooks/useHitosDashboard.js
/**
 * Hook para el tab "TO DO" (KPI de Hitos) en los dashboards departamentales.
 *
 * Cada hito puede tener múltiples responsables (tabla puente).
 * Los filtros de responsable y departamento aplican si CUALQUIERA de los
 * responsables del hito coincide.
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
  showAll: false,
  includeDone: false,
};

function uniqSorted(arr) {
  return [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Extrae todos los nombres de responsables de un hito como un array plano.
 */
function getResponsablesNombres(h) {
  if (Array.isArray(h.responsables) && h.responsables.length > 0) {
    return h.responsables.map((r) => r.nombre).filter(Boolean);
  }
  // compatibilidad legacy
  if (h.responsable_nombre) return [h.responsable_nombre];
  return [];
}

/**
 * Extrae todos los nombres de departamento de los responsables de un hito.
 */
function getDepartamentosNombres(h) {
  if (Array.isArray(h.responsables) && h.responsables.length > 0) {
    return h.responsables.map((r) => r.departamento_nombre).filter(Boolean);
  }
  if (h.departamento_nombre) return [h.departamento_nombre];
  return [];
}

function applyFilters(data, filters, exclude) {
  let out = data;

  if (filters.search && exclude !== 'search') {
    const q = filters.search.toLowerCase();
    out = out.filter(
      (h) =>
        (h.nombre || '').toLowerCase().includes(q) ||
        (h.proyecto_nombre || '').toLowerCase().includes(q) ||
        getResponsablesNombres(h).some((r) => r.toLowerCase().includes(q))
    );
  }

  if (filters.estado && exclude !== 'estado') {
    out = out.filter((h) => h.estado === filters.estado);
  }

  if (filters.departamento && exclude !== 'departamento') {
    out = out.filter((h) =>
      getDepartamentosNombres(h).includes(filters.departamento)
    );
  }

  if (filters.proyecto && exclude !== 'proyecto') {
    out = out.filter((h) => (h.proyecto_nombre || '') === filters.proyecto);
  }

  if (filters.responsable && exclude !== 'responsable') {
    out = out.filter((h) =>
      getResponsablesNombres(h).includes(filters.responsable)
    );
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

  useEffect(() => {
    if (departamentos.length > 0 || filters.departamento === '') {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.departamento]);

  const filtered = useMemo(
    () => applyFilters(allHitos, filters),
    [allHitos, filters]
  );

  const estadoOptions = useMemo(
    () => ['', 'PENDIENTE', 'VENCIDO', 'REALIZADO'],
    []
  );

  // Opciones de departamento: todos los departamentos presentes en responsables de los hitos
  const departamentoOptions = useMemo(
    () => [''].concat(
      uniqSorted(
        applyFilters(allHitos, filters, 'departamento')
          .flatMap((h) => getDepartamentosNombres(h))
      )
    ),
    [allHitos, filters]
  );

  const proyectoOptions = useMemo(
    () => [''].concat(uniqSorted(applyFilters(allHitos, filters, 'proyecto').map((h) => h.proyecto_nombre))),
    [allHitos, filters]
  );

  // Opciones de responsable: todos los responsables de todos los hitos filtrados
  const responsableOptions = useMemo(
    () => [''].concat(
      uniqSorted(
        applyFilters(allHitos, filters, 'responsable')
          .flatMap((h) => getResponsablesNombres(h))
      )
    ),
    [allHitos, filters]
  );

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
