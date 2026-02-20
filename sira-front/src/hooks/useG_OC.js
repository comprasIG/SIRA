import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

const CLOSED_STATUSES = ['ENTREGADA', 'RECHAZADA', 'CANCELADA'];
const KPI_KEYS = ['total', 'abiertas', 'porAutorizar', 'entregadas', 'rechazadas'];
const STATUS_ORDER = ['POR_AUTORIZAR', 'AUTORIZADA', 'EN_PROCESO', 'HOLD', 'ENTREGADA', 'RECHAZADA', 'CANCELADA'];

const INITIAL_FILTERS = {
    search: '',
    status: 'ABIERTAS',
    proyecto: '',
    sitio: '',
    proveedor: '',
    fechaInicio: '',
    fechaFin: '',
    sort_by: 'numero_oc_desc',
};

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const getOcNumber = (numeroOc) => {
    const match = String(numeroOc ?? '').match(/\d+/g);
    if (!match?.length) return Number.NaN;
    return Number(match[match.length - 1]);
};

const toDateStart = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateEndExclusive = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setDate(parsed.getDate() + 1);
    return parsed;
};

const isOpenStatus = (status) => !CLOSED_STATUSES.includes(status);
const isRejectedStatus = (status) => ['RECHAZADA', 'CANCELADA'].includes(status);

const matchesKpi = (status, activeKpi) => {
    if (!activeKpi || activeKpi === 'total') return true;
    if (activeKpi === 'abiertas') return isOpenStatus(status);
    if (activeKpi === 'porAutorizar') return status === 'POR_AUTORIZAR';
    if (activeKpi === 'entregadas') return status === 'ENTREGADA';
    if (activeKpi === 'rechazadas') return isRejectedStatus(status);
    return true;
};

const matchesByIdOrName = (filterValue, idValue, ...nameValues) => {
    if (!filterValue) return true;
    const rawFilter = String(filterValue).trim();
    if (idValue !== null && idValue !== undefined && String(idValue) === rawFilter) return true;

    const normalizedFilter = normalizeText(rawFilter);
    return nameValues.some((name) => normalizeText(name).includes(normalizedFilter));
};

const compareByName = (a, b) =>
    String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''), 'es', { sensitivity: 'base' });

const sortOcs = (items, sortBy) => {
    const output = [...items];

    if (sortBy === 'numero_oc_asc' || sortBy === 'numero_oc_desc') {
        const multiplier = sortBy === 'numero_oc_asc' ? 1 : -1;
        output.sort((a, b) => {
            const aNumber = getOcNumber(a?.numero_oc);
            const bNumber = getOcNumber(b?.numero_oc);

            if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber) && aNumber !== bNumber) {
                return (aNumber - bNumber) * multiplier;
            }

            const textCompare = String(a?.numero_oc ?? '').localeCompare(String(b?.numero_oc ?? ''), 'es', { sensitivity: 'base' });
            if (textCompare !== 0) return textCompare * multiplier;

            return ((Number(a?.id) || 0) - (Number(b?.id) || 0)) * multiplier;
        });
        return output;
    }

    const multiplier = sortBy === 'fecha_asc' ? 1 : -1;
    output.sort((a, b) => {
        const aTime = new Date(a?.fecha_creacion ?? 0).getTime();
        const bTime = new Date(b?.fecha_creacion ?? 0).getTime();

        if (aTime !== bTime) return (aTime - bTime) * multiplier;
        return ((Number(a?.id) || 0) - (Number(b?.id) || 0)) * multiplier;
    });

    return output;
};

const computeKpis = (items) =>
    items.reduce(
        (acc, oc) => {
            const currentStatus = oc?.status;
            acc.total += 1;
            if (currentStatus === 'POR_AUTORIZAR') acc.porAutorizar += 1;
            if (currentStatus === 'ENTREGADA') acc.entregadas += 1;
            if (isRejectedStatus(currentStatus)) acc.rechazadas += 1;
            if (isOpenStatus(currentStatus)) acc.abiertas += 1;
            return acc;
        },
        { total: 0, abiertas: 0, porAutorizar: 0, entregadas: 0, rechazadas: 0 }
    );

const getProveedorNombre = (oc) => {
    const razon = String(oc?.proveedor_razon_social || oc?.proveedor || '').trim();
    const marca = String(oc?.proveedor_marca || '').trim();

    if (razon && marca && normalizeText(razon) !== normalizeText(marca)) {
        return `${razon} (${marca})`;
    }

    return razon || marca || 'Sin proveedor';
};

const buildStatusOptions = (items) => {
    const dynamicStatuses = [...new Set(items.map((oc) => oc?.status).filter(Boolean))].sort((a, b) => {
        const aIndex = STATUS_ORDER.indexOf(a);
        const bIndex = STATUS_ORDER.indexOf(b);

        if (aIndex === -1 && bIndex === -1) {
            return a.localeCompare(b, 'es', { sensitivity: 'base' });
        }
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    return ['ABIERTAS', 'TODAS', ...dynamicStatuses.filter((status) => status !== 'ABIERTAS' && status !== 'TODAS')];
};

const buildEntityOptions = (items, keyConfig) => {
    const map = new Map();

    items.forEach((oc) => {
        const id = oc[keyConfig.idField];
        const baseName = keyConfig.getName(oc);

        if (!baseName) return;
        const optionId = id !== null && id !== undefined ? String(id) : baseName;

        if (!map.has(optionId)) {
            map.set(optionId, {
                id: optionId,
                nombre: baseName,
            });
        }
    });

    return [...map.values()].sort(compareByName);
};

const filterOcs = (items, filters, activeKpi, { excludeField = null, applyStatus = true, applyKpiFilter = true } = {}) => {
    const searchQuery = normalizeText(filters.search);
    const startDate = toDateStart(filters.fechaInicio);
    const endDateExclusive = toDateEndExclusive(filters.fechaFin);

    return items.filter((oc) => {
        if (applyStatus && excludeField !== 'status') {
            if (filters.status && filters.status !== 'TODAS') {
                if (filters.status === 'ABIERTAS') {
                    if (!isOpenStatus(oc?.status)) return false;
                } else if (oc?.status !== filters.status) {
                    return false;
                }
            }
        }

        if (excludeField !== 'proyecto' && !matchesByIdOrName(filters.proyecto, oc?.proyecto_id, oc?.proyecto)) return false;
        if (excludeField !== 'sitio' && !matchesByIdOrName(filters.sitio, oc?.sitio_id, oc?.sitio)) return false;
        if (
            excludeField !== 'proveedor' &&
            !matchesByIdOrName(filters.proveedor, oc?.proveedor_id, oc?.proveedor, oc?.proveedor_razon_social, oc?.proveedor_marca)
        ) {
            return false;
        }

        if (searchQuery && excludeField !== 'search') {
            const searchableFields = [
                oc?.numero_oc,
                oc?.proveedor,
                oc?.proveedor_razon_social,
                oc?.proveedor_marca,
                oc?.sitio,
                oc?.proyecto,
                oc?.departamento_requisicion,
            ];
            const hasMatch = searchableFields.some((field) => normalizeText(field).includes(searchQuery));
            if (!hasMatch) return false;
        }

        if ((startDate || endDateExclusive) && excludeField !== 'fecha') {
            const createdAt = new Date(oc?.fecha_creacion ?? '');
            if (Number.isNaN(createdAt.getTime())) return false;
            if (startDate && createdAt < startDate) return false;
            if (endDateExclusive && createdAt >= endDateExclusive) return false;
        }

        if (applyKpiFilter && !matchesKpi(oc?.status, activeKpi)) return false;

        return true;
    });
};

export const useG_OC = () => {
    const [baseOcs, setBaseOcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [activeKpi, setActiveKpi] = useState(null);

    const fetchOCs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/ocs');
            setBaseOcs(Array.isArray(data?.ocs) ? data.ocs : []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar las ordenes de compra.');
            setBaseOcs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOCs();
    }, [fetchOCs]);

    const applyStatusFilter = !activeKpi;

    const options = useMemo(() => {
        const statusBase = filterOcs(baseOcs, filters, activeKpi, { excludeField: 'status', applyStatus: false, applyKpiFilter: true });
        const proyectoBase = filterOcs(baseOcs, filters, activeKpi, { excludeField: 'proyecto', applyStatus: applyStatusFilter, applyKpiFilter: true });
        const sitioBase = filterOcs(baseOcs, filters, activeKpi, { excludeField: 'sitio', applyStatus: applyStatusFilter, applyKpiFilter: true });
        const proveedorBase = filterOcs(baseOcs, filters, activeKpi, { excludeField: 'proveedor', applyStatus: applyStatusFilter, applyKpiFilter: true });

        return {
            status: buildStatusOptions(statusBase),
            proyectos: buildEntityOptions(proyectoBase, {
                idField: 'proyecto_id',
                getName: (oc) => String(oc?.proyecto || '').trim(),
            }),
            sitios: buildEntityOptions(sitioBase, {
                idField: 'sitio_id',
                getName: (oc) => String(oc?.sitio || '').trim(),
            }),
            proveedores: buildEntityOptions(proveedorBase, {
                idField: 'proveedor_id',
                getName: (oc) => getProveedorNombre(oc),
            }),
        };
    }, [baseOcs, filters, activeKpi, applyStatusFilter]);

    useEffect(() => {
        setFilters((prev) => {
            let changed = false;
            const next = { ...prev };

            if (next.proyecto && !options.proyectos.some((item) => String(item.id) === String(next.proyecto))) {
                next.proyecto = '';
                changed = true;
            }

            if (next.sitio && !options.sitios.some((item) => String(item.id) === String(next.sitio))) {
                next.sitio = '';
                changed = true;
            }

            if (next.proveedor && !options.proveedores.some((item) => String(item.id) === String(next.proveedor))) {
                next.proveedor = '';
                changed = true;
            }

            if (next.status && !options.status.includes(next.status)) {
                next.status = 'TODAS';
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [options]);

    const filteredAndSortedOcs = useMemo(() => {
        const filtered = filterOcs(baseOcs, filters, activeKpi, { applyStatus: applyStatusFilter, applyKpiFilter: true });
        return sortOcs(filtered, filters.sort_by);
    }, [baseOcs, filters, activeKpi, applyStatusFilter]);

    const kpis = useMemo(() => {
        const kpiBase = filterOcs(baseOcs, filters, null, { applyStatus: false, applyKpiFilter: false });
        return computeKpis(kpiBase);
    }, [baseOcs, filters]);

    const handleFilterChange = useCallback(
        (name, value) => {
            setFilters((prev) => ({ ...prev, [name]: value }));
            if (name === 'status' && activeKpi) {
                setActiveKpi(null);
            }
        },
        [activeKpi]
    );

    const handleKpiClick = useCallback((kpiKey) => {
        if (!KPI_KEYS.includes(kpiKey)) return;
        setActiveKpi((prev) => {
            const next = prev === kpiKey ? null : kpiKey;
            if (next) {
                setFilters((current) => ({ ...current, status: 'TODAS' }));
            }
            return next;
        });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(INITIAL_FILTERS);
        setActiveKpi(null);
    }, []);

    return {
        ocs: filteredAndSortedOcs,
        loading,
        kpis,
        activeKpi,
        filters,
        options,
        handleFilterChange,
        handleKpiClick,
        resetFilters,
        refresh: fetchOCs,
    };
};

