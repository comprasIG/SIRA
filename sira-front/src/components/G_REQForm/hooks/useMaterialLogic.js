// C:\SIRA\sira-front\src\components\G_REQForm\hooks\useMaterialLogic.js
import { useState, useEffect } from 'react';
import { useDebounce } from '../utils'; // Importamos el hook useDebounce que ya existía
import api from '../../../api/api'; // Asegúrate que la ruta al api.js sea correcta

/**
 * Custom Hook para manejar la lógica de búsqueda y selección de materiales.
 * @param {Function} setValue - La función setValue de react-hook-form.
 * @returns {object} - Estados y manejadores para la lógica de materiales.
 */
export function useMaterialLogic(setValue) {
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [skuOptions, setSkuOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [unidadesLoading, setUnidadesLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [skuSearchTerm, setSkuSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedSkuSearchTerm = useDebounce(skuSearchTerm, 500);

  /* 
     Lógica unificada: 'materialesOptions' ahora contendrán resultados por SKU o Nombre.
     Eliminamos 'skuOptions', 'skuLoading' y 'skuSearchTerm' ya que se usa un solo input.
  */

  useEffect(() => {
    const buscarMateriales = async (query) => {
      // Permitir búsqueda vacía para limpiar opciones o mostrar defaults si se quisiera
      if (!query) {
        setMaterialesOptions([]);
        return;
      }
      setLoading(true);
      try {
        // La API ahora maneja sku OR nombre en el param 'query'
        const data = await api.get(`/api/materiales?query=${encodeURIComponent(query)}`);
        setMaterialesOptions(data);
      } catch (err) {
        console.error("Error en el fetch de materiales:", err);
        setMaterialesOptions([]);
      } finally {
        setLoading(false);
      }
    };

    buscarMateriales(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  // ELIMINADO: useEffect de búsqueda por SKU separado.

  const handleMaterialChange = async (selectedOption, fieldOnChange, index, proyecto_id) => {
    // Se actualiza el valor del campo 'material' en el formulario
    fieldOnChange(selectedOption);

    // Si se deselecciona un material, se limpia la unidad y el stock
    if (!selectedOption) {
      setValue(`items.${index}.unidad`, '');
      setValue(`items.${index}.stock_general`, '');
      setValue(`items.${index}.apartado_proyecto`, '');
      return;
    }

    // Si se selecciona un material, se busca su detalle (unidad + stock)
    setUnidadesLoading(prev => ({ ...prev, [index]: true }));
    try {
      // Pasamos el proyecto_id para obtener el apartado específico
      const url = `/api/materiales/${selectedOption.id}${proyecto_id ? `?proyecto_id=${proyecto_id}` : ''}`;
      const materialDetails = await api.get(url);

      setValue(`items.${index}.unidad`, materialDetails.unidad || 'N/A');
      // Guardamos la info de stock en el item para mostrarla en FilaMaterial
      setValue(`items.${index}.stock_general`, materialDetails.stock_general ?? 0);
      setValue(`items.${index}.apartado_proyecto`, materialDetails.apartado_proyecto ?? 0);

    } catch (error) {
      console.error(`Error al obtener detalles para material ${selectedOption.id}:`, error);
      setValue(`items.${index}.unidad`, 'Error');
    } finally {
      setUnidadesLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  return {
    materialesOptions,
    loading,
    // skuOptions, (Eliminado)
    // skuLoading, (Eliminado)
    unidadesLoading,
    searchTerm,
    setSearchTerm,
    // skuSearchTerm, (Eliminado)
    // setSkuSearchTerm, (Eliminado)
    handleMaterialChange,
  };
}
