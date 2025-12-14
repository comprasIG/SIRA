import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import dashboardConfig from '../components/dashboard/dashboardConfig';
import { AuthContext } from '../context/authContext';
import api from '../api/api';

const DEFAULT_FILTERS = {
  rfq_status: 'ACTIVOS', // default
  oc_status: '',         // Todos
  departamento_id: '',   // Todos (solo para Compras)
  sitio: '',             // Todos
  proyecto: '',          // Todos
};

function uniqSorted(arr) {
  return [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function isActiveStatus(value) {
  return value !== 'ENTREGADA' && value !== 'CANCELADA';
}

/**
 * Filtra RFQs por filtros seleccionados.
 * - RFQ status: 'ACTIVOS' => excluye ENTREGADA y CANCELADA
 * - OC status: filtra por existencia de alguna OC con ese status dentro del RFQ
 * - Sitio/Proyecto: exact match por nombre (dropdown)
 *
 * excludeKey permite calcular opciones facetadas:
 * se aplican todos los filtros EXCEPTO el de esa facet.
 */
function filterRfqs(rfqs, filters, excludeKey = null) {
  let out = Array.isArray(rfqs) ? rfqs : [];

  // Departamento (si viene en el payload) lo filtra backend normalmente; aquí solo por seguridad.
  if (excludeKey !== 'departamento_id' && filters.departamento_id) {
    out = out.filter((r) => String(r.departamento_id || '') === String(filters.departamento_id));
  }

  // Sitio
  if (excludeKey !== 'sitio' && filters.sitio) {
    out = out.filter((r) => (r.sitio || '') === filters.sitio);
  }

  // Proyecto
  if (excludeKey !== 'proyecto' && filters.proyecto) {
    out = out.filter((r) => (r.proyecto || '') === filters.proyecto);
  }

  // RFQ status
  if (excludeKey !== 'rfq_status') {
    if (filters.rfq_status === 'ACTIVOS') {
      out = out.filter((r) => isActiveStatus(r.rfq_status));
    } else if (filters.rfq_status) {
      out = out.filter((r) => r.rfq_status === filters.rfq_status);
    }
  }

  // OC status
  if (excludeKey !== 'oc_status') {
    const want = filters.oc_status;

    if (want === 'ACTIVOS') {
      out = out.filter((r) => (r.ordenes || []).some((oc) => isActiveStatus(oc.oc_status)));
    } else if (want) {
      out = out.filter((r) => (r.ordenes || []).some((oc) => oc.oc_status === want));
    }
  }

  return out;
}

function computeKpis(rfqs) {
  let porAutorizar = 0;
  let esperandoEntrega = 0;

  (rfqs || []).forEach((rfq) => {
    (rfq.ordenes || []).forEach((oc) => {
      if (oc.oc_status === 'POR_AUTORIZAR') porAutorizar++;
      if (oc.oc_status === 'ESPERANDO_ENTREGA' || oc.oc_status === 'EN_PROCESO') esperandoEntrega++;
    });
  });

  return {
    rfqActivos: (rfqs || []).length,
    porAutorizar,
    esperandoEntrega,
  };
}

export function useDashboard(mode) {
  const { user } = useContext(AuthContext) || {};
  const config = dashboardConfig[mode] || {};

  // Base data (sin filtros facetados de UI; solo lo mínimo)
  const [baseRfqs, setBaseRfqs] = useState([]);
  const [loadingBase, setLoadingBase] = useState(false);

  // Filtros UI
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // Opciones (facetadas)
  const [options, setOptions] = useState({
    rfqStatus: [],     // incluye 'ACTIVOS' + enums presentes
    ocStatus: [],      // incluye '' + 'ACTIVOS' + enums presentes
    departamentos: [], // desde endpoint (si aplica)
    sitios: [],
    proyectos: [],
  });

  const [kpis, setKpis] = useState({ rfqActivos: 0, porAutorizar: 0, esperandoEntrega: 0 });
  const [rfqs, setRfqs] = useState([]);
  const [error, setError] = useState(null);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setFilter = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  // 1) Cargar enums + departamentos (una vez)
  useEffect(() => {
    let cancelled = false;

    async function loadStaticOptions() {
      try {
        const [statusRes, deptoRes] = await Promise.all([
          api.get('/api/dashboard/status-options'),
          config.showDepartmentFilter ? api.get('/api/dashboard/departamentos') : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setOptions((prev) => ({
          ...prev,
          departamentos: Array.isArray(deptoRes) ? deptoRes : [],
          // rfqStatus/ocStatus los haremos facetados más abajo con base a data,
          // pero guardamos estos enums como referencia si los necesitas luego.
          _rfqEnum: statusRes?.rfqStatus || [],
          _ocEnum: statusRes?.ocStatus || [],
        }));
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err?.error || err?.message || 'No se pudieron cargar opciones iniciales.');
      }
    }

    loadStaticOptions();
    return () => {
      cancelled = true;
    };
  }, [config.showDepartmentFilter]);

  // 2) Cargar data base del dashboard.
  // Importante: aquí NO aplicamos rfq_status/oc_status/sitio/proyecto para poder facetar en front.
  // Solo filtramos por departamento si el usuario lo selecciona (para reducir dataset).
  const loadBaseData = useCallback(async (departamentoId) => {
    setLoadingBase(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (departamentoId) params.append('departamento_id', departamentoId);

      const endpoint = config.endpoint || '/api/dashboard/compras';
      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

      const data = await api.get(url);
      setBaseRfqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err?.error || err?.message || 'Error al cargar datos del dashboard.');
      setBaseRfqs([]);
    } finally {
      setLoadingBase(false);
    }
  }, [config.endpoint]);

  // carga inicial
  useEffect(() => {
    loadBaseData(filters.departamento_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // si cambia departamento (solo Compras normalmente), recargamos dataset base
  useEffect(() => {
    loadBaseData(filters.departamento_id);
  }, [filters.departamento_id, loadBaseData]);

  // 3) Filtros facetados vivos:
  // Cada vez que cambia cualquier filtro (excepto depto que ya recarga),
  // recalculamos:
  // - rfqs filtrados
  // - KPIs
  // - opciones disponibles para cada dropdown (facets)
  const facets = useMemo(() => {
    // Para calcular opciones de cada facet, filtramos por “otros filtros” (excludeKey)
    const dataForRfqStatus = filterRfqs(baseRfqs, filters, 'rfq_status');
    const dataForOcStatus = filterRfqs(baseRfqs, filters, 'oc_status');
    const dataForSitio     = filterRfqs(baseRfqs, filters, 'sitio');
    const dataForProyecto  = filterRfqs(baseRfqs, filters, 'proyecto');

    // RFQ statuses presentes (más ACTIVOS)
    const rfqStatusPresent = uniqSorted((dataForRfqStatus || []).map((r) => r.rfq_status));
    const rfqStatusOptions = ['ACTIVOS', ...rfqStatusPresent];

    // OC statuses presentes (más ''/ACTIVOS)
    const ocStatusSet = [];
    (dataForOcStatus || []).forEach((r) => {
      (r.ordenes || []).forEach((oc) => {
        if (oc.oc_status) ocStatusSet.push(oc.oc_status);
      });
    });
    const ocStatusPresent = uniqSorted(ocStatusSet);
    const ocStatusOptions = ['', 'ACTIVOS', ...ocStatusPresent];

    // Sitios presentes
    const sitiosOptions = [''].concat(uniqSorted((dataForSitio || []).map((r) => r.sitio)));

    // Proyectos presentes (dependen de sitio seleccionado porque proyecto facet se calcula excluyendo 'proyecto')
    const proyectosOptions = [''].concat(uniqSorted((dataForProyecto || []).map((r) => r.proyecto)));

    return {
      rfqStatusOptions,
      ocStatusOptions,
      sitiosOptions,
      proyectosOptions,
    };
  }, [baseRfqs, filters]);

  // Auto-limpiar filtros que se vuelven inválidos
  useEffect(() => {
    setFilters((prev) => {
      let next = { ...prev };
      let changed = false;

      if (next.rfq_status && !facets.rfqStatusOptions.includes(next.rfq_status)) {
        next.rfq_status = 'ACTIVOS';
        changed = true;
      }

      if (next.oc_status && !facets.ocStatusOptions.includes(next.oc_status)) {
        next.oc_status = '';
        changed = true;
      }

      if (next.sitio && !facets.sitiosOptions.includes(next.sitio)) {
        next.sitio = '';
        changed = true;
      }

      if (next.proyecto && !facets.proyectosOptions.includes(next.proyecto)) {
        next.proyecto = '';
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [facets]);

  // Aplicar filtros finales (con todos)
  useEffect(() => {
    const filtered = filterRfqs(baseRfqs, filters, null);
    setRfqs(filtered);
    setKpis(computeKpis(filtered));

    // Publicar options a UI
    setOptions((prev) => ({
      ...prev,
      rfqStatus: facets.rfqStatusOptions,
      ocStatus: facets.ocStatusOptions,
      sitios: facets.sitiosOptions,
      proyectos: facets.proyectosOptions,
    }));
  }, [baseRfqs, filters, facets]);

  const loading = loadingBase;

  return {
    user,
    loading,
    error,
    kpis,
    rfqs,
    filters,
    options,
    setFilter,
    resetFilters,
  };
}
