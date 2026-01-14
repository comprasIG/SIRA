// sira-front/src/hooks/useRetiro.js
import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

/**
 * Hook: useRetiro
 * =========================================================================================
 * Encapsula:
 * - Carga inicial de datos para filtros (sitios/proyectos/materiales)
 * - Carga de empleados activos (para "solicitante")
 * - Consultas: asignaciones por sitio/proyecto, stock por material
 * - Acción: registrar retiro
 *
 * Nota:
 * - El backend valida que solicitanteEmpleadoId exista y sea status_laboral='activo'
 */
export const useRetiro = () => {
  const [loading, setLoading] = useState(true);

  const [filterOptions, setFilterOptions] = useState({
    sitiosAsignados: [],
    proyectosAsignados: [],
    materialesEnStock: [],
    todosProyectos: [],
    todosSitios: [],
  });

  const [empleadosActivos, setEmpleadosActivos] = useState([]);

  const [materialesAsignados, setMaterialesAsignados] = useState([]);
  const [loadingAsignados, setLoadingAsignados] = useState(false);

  const [stockInfo, setStockInfo] = useState({ stock_total: 0, ubicaciones_con_stock: [] });
  const [loadingStock, setLoadingStock] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Carga inicial (filtros + empleados activos)
  // ---------------------------------------------------------------------------
  const fetchFilterData = useCallback(async () => {
    setLoading(true);
    try {
      const [filtros, empleados] = await Promise.all([
        api.get('/api/retiro/datos-filtros'),
        api.get('/api/empleados?status_laboral=activo&limit=1000'),
      ]);

      setFilterOptions(
        filtros || {
          sitiosAsignados: [],
          proyectosAsignados: [],
          materialesEnStock: [],
          todosProyectos: [],
          todosSitios: [],
        },
      );

      setEmpleadosActivos(Array.isArray(empleados) ? empleados : []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar datos iniciales de retiro.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  // ---------------------------------------------------------------------------
  // Buscar materiales asignados a un sitio/proyecto
  // ---------------------------------------------------------------------------
  const fetchMaterialesAsignados = useCallback(async (sitioId, proyectoId) => {
    if (!sitioId || !proyectoId) {
      setMaterialesAsignados([]);
      return;
    }

    setLoadingAsignados(true);
    try {
      const data = await api.get(`/api/retiro/asignado/${sitioId}/${proyectoId}`);
      setMaterialesAsignados(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar materiales asignados.');
      setMaterialesAsignados([]);
    } finally {
      setLoadingAsignados(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Buscar stock de un material (solo si necesitas detalle por ubicaciones)
  // ---------------------------------------------------------------------------
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
      console.error(error);
      toast.error('Error al cargar stock del material.');
      setStockInfo({ stock_total: 0, ubicaciones_con_stock: [] });
    } finally {
      setLoadingStock(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Registrar retiro
  // ---------------------------------------------------------------------------
  const registrarRetiro = async (payload) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/api/retiro/registrar', payload);
      toast.success(response.mensaje || 'Retiro registrado con éxito.');

      // Refrescar datos relevantes (por ejemplo, puede que ya no haya asignaciones/stock)
      await fetchFilterData();

      return response; // devolvemos el response (incluye salida_almacen_id)
    } catch (error) {
      console.error(error);
      toast.error(error?.error || 'Error al registrar el retiro.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    loading,
    filterOptions,
    empleadosActivos,

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
