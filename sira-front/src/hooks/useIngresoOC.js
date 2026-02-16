// sira-front/src/hooks/useIngresoOC.js
import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';

const initialFilters = {
    proveedorId: '',
    sitioId: '',
    proyectoId: '',
    departamentoId: '',
    search: '',
    metodo_recoleccion_id: '',
    entrega_responsable: '',
    entrega_parcial: '',
    con_incidencia: '',
};

export const useIngresoOC = () => {
    const [ocsEnProceso, setOcsEnProceso] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState({});
    const [filters, setFilters] = useState(initialFilters);
    const [filterOptions, setFilterOptions] = useState({
        proveedores: [], sitios: [], proyectos: [], departamentos: [],
        ubicacionesAlmacen: [], tiposIncidencia: [],
    });

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/ingreso/datos-iniciales');
            setKpis(data.kpis || {});
            setFilterOptions(data.filterOptions || {
                proveedores: [], sitios: [], proyectos: [], departamentos: [],
                ubicacionesAlmacen: [], tiposIncidencia: [],
            });
            // Una vez cargados los datos iniciales, busca las OCs
            await fetchOcsEnProceso(filters); // Pasa los filtros actuales
        } catch (error) {
            toast.error('Error al cargar datos iniciales.');
            setLoading(false); // Asegúrate de detener la carga incluso si hay error inicial
        }
        // setLoading(false) se maneja dentro de fetchOcsEnProceso
    }, [filters]); // Depende de filters para la llamada inicial a fetchOcsEnProceso

    const fetchOcsEnProceso = useCallback(async (currentFilters) => {
        // setLoading(true); // Se inicia en fetchInitialData o al cambiar filtros
        try {
            const cleanFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(([, v]) => v != null && v !== '')
            );
            const queryParams = new URLSearchParams(cleanFilters).toString();
            const data = await api.get(`/api/ingreso/ocs-en-proceso?${queryParams}`);
            setOcsEnProceso(data || []);
        } catch (error) {
            toast.error('Error al cargar las órdenes en proceso.');
            setOcsEnProceso([]); // Limpia en caso de error
        } finally {
            setLoading(false); // Detiene la carga después de buscar OCs
        }
    }, []);

    const debouncedFetch = useCallback(debounce((currentFilters) => {
        setLoading(true); // Inicia carga al empezar búsqueda debounced
        fetchOcsEnProceso(currentFilters);
    }, 500), [fetchOcsEnProceso]);

    useEffect(() => {
        fetchInitialData();
        // La llamada a fetchOcsEnProceso ahora se hace dentro de fetchInitialData
    }, [fetchInitialData]); // Solo se llama una vez al montar

    const isFirstLoad = useRef(true);

    // Efecto separado para reaccionar a cambios en filters con debounce
    useEffect(() => {
        // No llamar en la carga inicial, ya se hizo en fetchInitialData
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        debouncedFetch(filters);
        return () => debouncedFetch.cancel();
    }, [filters, debouncedFetch]);


    const refreshData = () => {
        // Llama a fetchInitialData para recargar KPIs, opciones Y la lista de OCs con filtros actuales
        fetchInitialData();
    };

    const resetFilters = () => {
        setFilters(initialFilters);
        // fetchOcsEnProceso(initialFilters); // El useEffect [filters] se encargará
    };

    const getDetallesOC = async (ocId) => {
        try {
            const detalles = await api.get(`/api/ingreso/oc/${ocId}/detalles`);
            return detalles;
        } catch (error) {
            toast.error(`Error al cargar detalles de la OC ${ocId}.`);
            return []; // Devuelve vacío en caso de error
        }
    };

    const registrarIngreso = async (payload) => {
        try {
            await api.post('/api/ingreso/registrar', payload);
            toast.success('Ingreso registrado con éxito.');
            refreshData(); // Recarga todo
        } catch (error) {
            toast.error(error?.error || 'Error al registrar el ingreso.');
            throw error; // Propaga para manejo en el modal si es necesario
        }
    };

    return {
        ocsEnProceso,
        loading,
        kpis,
        filters,
        setFilters,
        filterOptions,
        resetFilters,
        getDetallesOC,
        registrarIngreso,
        refreshData,
    };
};