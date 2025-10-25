// sira-front/src/hooks/useRetiro.js
import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useRetiro = () => {
    const [loading, setLoading] = useState(true);
    const [filterOptions, setFilterOptions] = useState({
        sitiosAsignados: [],
        proyectosAsignados: [],
        materialesEnStock: [],
        todosProyectos: [],
        todosSitios: [],
    });
    const [materialesAsignados, setMaterialesAsignados] = useState([]);
    const [loadingAsignados, setLoadingAsignados] = useState(false);
    const [stockInfo, setStockInfo] = useState({ stock_total: 0, ubicaciones_con_stock: [] });
    const [loadingStock, setLoadingStock] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Carga inicial de opciones para filtros
    const fetchFilterData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/retiro/datos-filtros');
            setFilterOptions(data || {
                sitiosAsignados: [], proyectosAsignados: [], materialesEnStock: [],
                todosProyectos: [], todosSitios: [],
            });
        } catch (error) {
            toast.error('Error al cargar opciones de filtro.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

    // Buscar materiales asignados a un sitio/proyecto
    const fetchMaterialesAsignados = useCallback(async (sitioId, proyectoId) => {
        if (!sitioId || !proyectoId) {
            setMaterialesAsignados([]);
            return;
        }
        setLoadingAsignados(true);
        try {
            const data = await api.get(`/api/retiro/asignado/${sitioId}/${proyectoId}`);
            setMaterialesAsignados(data || []);
        } catch (error) {
            toast.error('Error al cargar materiales asignados.');
            setMaterialesAsignados([]);
        } finally {
            setLoadingAsignados(false);
        }
    }, []);

    // Buscar stock de un material
    const fetchStockMaterial = useCallback(async (materialId) => {
        if (!materialId) {
            setStockInfo({ stock_total: 0, ubicaciones_con_stock: [] });
            return;
        }
        setLoadingStock(true);
        try {
            const data = await api.get(`/api/retiro/stock/${materialId}`);
            setStockInfo(data || { stock_total: 0, ubicaciones_con_stock: [] });
        } catch (error) {
            toast.error('Error al cargar stock del material.');
            setStockInfo({ stock_total: 0, ubicaciones_con_stock: [] });
        } finally {
            setLoadingStock(false);
        }
    }, []);

    // Registrar el retiro
    const registrarRetiro = async (payload) => {
        setIsSubmitting(true);
        try {
            const response = await api.post('/api/retiro/registrar', payload);
            toast.success(response.mensaje || 'Retiro registrado con éxito.');
            // Refrescar datos relevantes después del éxito
            fetchFilterData(); // Recarga opciones (puede que un sitio/proyecto ya no tenga asignaciones)
            // Podrías añadir lógica para limpiar el estado específico del formulario que llamó
            return true; // Indica éxito
        } catch (error) {
            toast.error(error?.error || 'Error al registrar el retiro.');
            return false; // Indica fallo
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        loading,
        filterOptions,
        materialesAsignados,
        loadingAsignados,
        fetchMaterialesAsignados,
        stockInfo,
        loadingStock,
        fetchStockMaterial,
        registrarRetiro,
        isSubmitting,
    };
};