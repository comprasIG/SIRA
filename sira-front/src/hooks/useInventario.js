// sira-front/src/hooks/useInventario.js
/**
 * Hook: useInventario
 * --------------------------------------------------------------------------------------
 * Soporta 3 modos:
 * - mode: "inventario" (default) -> usa GET /api/inventario
 * - mode: "catalogo"             -> usa GET /api/inventario/catalogo-resumen (Paso 9C)
 * - mode: "both"                 -> carga ambos (si alguna pantalla lo necesitara)
 *
 * Mantiene backwards compatibility: si otras pantallas ya usan useInventario() sin params,
 * NO se rompen.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import debounce from "lodash.debounce";
import { toast } from "react-toastify";
import api from "../api/api";

/** ---------------------------------------------
 * Configuración base
 * --------------------------------------------- */
const initialFilters = {
  estado: "TODOS",
  sitioId: "",
  proyectoId: "",
  search: "",
};

const initialKpis = {
  kpi_skus: 0,
  valores_disponibles: [],
  valores_apartados: [],
};

export const useInventario = (options = {}) => {
  const mode = options.mode || "inventario"; // "inventario" | "catalogo" | "both"

  /** ---------------------------------------------
   * Estado común
   * --------------------------------------------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [kpis, setKpis] = useState(initialKpis);
  const [filters, setFilters] = useState(initialFilters);

  const [filterOptions, setFilterOptions] = useState({
    sitios: [],
    proyectos: [],
    todosSitios: [],
    todosProyectos: [],
    ubicacionesAlmacen: [],
  });

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Evitar disparar debounce antes de la carga inicial
  const didInitRef = useRef(false);

  /** ---------------------------------------------
   * Estado de listas
   * --------------------------------------------- */
  const [inventario, setInventario] = useState([]); // /api/inventario
  const [catalogoResumen, setCatalogoResumen] = useState([]); // /api/inventario/catalogo-resumen

  /** ---------------------------------------------
   * Helpers
   * --------------------------------------------- */
  const normalizeFilters = useCallback((raw) => {
    const entries = Object.entries(raw || {}).filter(([, v]) => v != null && v !== "");
    return Object.fromEntries(entries);
  }, []);

  /** ---------------------------------------------
   * API: lista inventario (existentes)
   * --------------------------------------------- */
  const fetchInventario = useCallback(
    async (currentFilters) => {
      setLoading(true);
      setError(null);

      try {
        const cleanFilters = normalizeFilters(currentFilters);
        const queryParams = new URLSearchParams(cleanFilters).toString();
        const data = await api.get(`/api/inventario?${queryParams}`);

        const list = Array.isArray(data) ? data : [];
        setInventario(list);
        return list;
      } catch (e) {
        const msg = e?.error || "Error al cargar la lista de inventario.";
        toast.error(msg);
        setError(msg);
        setInventario([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [normalizeFilters]
  );

  /** ---------------------------------------------
   * ✅ Paso 9C: API catálogo resumen (activos + ceros)
   * --------------------------------------------- */
  const fetchCatalogoResumen = useCallback(
    async (currentFilters) => {
      setLoading(true);
      setError(null);

      try {
        const cleanFilters = normalizeFilters(currentFilters);
        const queryParams = new URLSearchParams(cleanFilters).toString();
        const data = await api.get(`/api/inventario/catalogo-resumen?${queryParams}`);

        const list = Array.isArray(data) ? data : [];
        setCatalogoResumen(list);
        return list;
      } catch (e) {
        const msg = e?.error || "Error al cargar el catálogo resumen.";
        toast.error(msg);
        setError(msg);
        setCatalogoResumen([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [normalizeFilters]
  );

  /** ---------------------------------------------
   * API: datos iniciales (KPIs + filterOptions)
   * --------------------------------------------- */
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get("/api/inventario/datos-iniciales");

      const fo = data?.filterOptions || {};
      setFilterOptions({
        sitios: fo.sitios || [],
        proyectos: fo.proyectos || [],
        todosSitios: fo.todosSitios || [],
        todosProyectos: fo.todosProyectos || [],
        ubicacionesAlmacen: fo.ubicacionesAlmacen || [],
      });

      setKpis(data?.kpis || initialKpis);

      // Primera carga según modo
      let list = [];
      if (mode === "inventario") list = await fetchInventario(initialFilters);
      else if (mode === "catalogo") list = await fetchCatalogoResumen(initialFilters);
      else {
        await Promise.all([fetchInventario(initialFilters), fetchCatalogoResumen(initialFilters)]);
        list = [];
      }

      didInitRef.current = true;
      return list;
    } catch (e) {
      const msg = e?.error || "Error al cargar datos iniciales del inventario.";
      toast.error(msg);
      setError(msg);
      setLoading(false);
      return [];
    }
  }, [fetchInventario, fetchCatalogoResumen, mode]);

  /** ---------------------------------------------
   * Debounce: al cambiar filtros, recargar según modo
   * --------------------------------------------- */
  const debouncedFetch = useMemo(() => {
    return debounce(async (currentFilters) => {
      if (mode === "inventario") await fetchInventario(currentFilters);
      else if (mode === "catalogo") await fetchCatalogoResumen(currentFilters);
      else await Promise.all([fetchInventario(currentFilters), fetchCatalogoResumen(currentFilters)]);
    }, 500);
  }, [fetchInventario, fetchCatalogoResumen, mode]);

  /** ---------------------------------------------
   * Efectos
   * --------------------------------------------- */
  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didInitRef.current) return;

    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);

  /** ---------------------------------------------
   * Acciones públicas (listas)
   * --------------------------------------------- */
  const resetFilters = useCallback(async () => {
    setFilters(initialFilters);

    if (mode === "inventario") return await fetchInventario(initialFilters);
    if (mode === "catalogo") return await fetchCatalogoResumen(initialFilters);

    await Promise.all([fetchInventario(initialFilters), fetchCatalogoResumen(initialFilters)]);
    return [];
  }, [fetchInventario, fetchCatalogoResumen, mode]);

  const refreshInventario = useCallback(async () => {
    return await fetchInventario(filters);
  }, [fetchInventario, filters]);

  const refreshCatalogoResumen = useCallback(async () => {
    return await fetchCatalogoResumen(filters);
  }, [fetchCatalogoResumen, filters]);

  /** ---------------------------------------------
   * Detalle de asignaciones
   * --------------------------------------------- */
  const getDetalleAsignaciones = useCallback(async (materialId) => {
    try {
      const data = await api.get(`/api/inventario/material/${materialId}/asignaciones`);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      toast.error("Error al obtener detalle de asignaciones.");
      return [];
    }
  }, []);

  /** ---------------------------------------------
   * Acciones: apartar / mover
   * --------------------------------------------- */
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get("/api/inventario/datos-iniciales");

      const fo = data?.filterOptions || {};
      setFilterOptions({
        sitios: fo.sitios || [],
        proyectos: fo.proyectos || [],
        todosSitios: fo.todosSitios || [],
        todosProyectos: fo.todosProyectos || [],
        ubicacionesAlmacen: fo.ubicacionesAlmacen || [],
      });

      setKpis(data?.kpis || initialKpis);

      if (mode === "inventario") return await fetchInventario(filters);
      if (mode === "catalogo") return await fetchCatalogoResumen(filters);

      await Promise.all([fetchInventario(filters), fetchCatalogoResumen(filters)]);
      return [];
    } catch (e) {
      const msg = e?.error || "Error al refrescar los datos.";
      toast.error(msg);
      setError(msg);
      setLoading(false);
      return [];
    }
  }, [fetchInventario, fetchCatalogoResumen, filters, mode]);

  const apartarStock = useCallback(
    async (payload) => {
      setIsSubmittingAction(true);
      try {
        const response = await api.post("/api/inventario/apartar", payload);
        toast.success(response?.mensaje || "Material apartado con éxito.");
        await refreshData();
        return true;
      } catch (e) {
        toast.error(e?.error || "Error al apartar material.");
        return false;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [refreshData]
  );

  const moverAsignacion = useCallback(
    async (payload) => {
      setIsSubmittingAction(true);
      try {
        const response = await api.post("/api/inventario/mover-asignacion", payload);
        toast.success(response?.mensaje || "Asignación movida con éxito.");
        await refreshData();
        return true;
      } catch (e) {
        toast.error(e?.error || "Error al mover asignación.");
        return false;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [refreshData]
  );

  /** ---------------------------------------------
   * API pública
   * --------------------------------------------- */
  return {
    // comunes
    loading,
    error,
    kpis,
    filters,
    setFilters,
    filterOptions,

    // listas
    inventario,
    catalogoResumen,

    // fetch/refresh
    resetFilters,
    refreshInventario,
    refreshCatalogoResumen,

    // acciones
    getDetalleAsignaciones,
    apartarStock,
    moverAsignacion,
    isSubmittingAction,
  };
};
