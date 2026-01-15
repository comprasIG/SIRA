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

  useEffect(() => {
    const buscarMateriales = async (query) => {
      if (!query) {
        setMaterialesOptions([]);
        return;
      }
      setLoading(true);
      try {
        // Usamos nuestra instancia de api configurada
        const data = await api.get(`/api/materiales?query=${encodeURIComponent(query)}`);
        setMaterialesOptions(data);
      } catch (err) {
        console.error("Error en el fetch de materiales:", err);
        setMaterialesOptions([]); // En caso de error, limpiar las opciones
      } finally {
        setLoading(false);
      }
    };

    buscarMateriales(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const buscarMaterialesPorSku = async (sku) => {
      if (!sku) {
        setSkuOptions([]);
        return;
      }
      setSkuLoading(true);
      try {
        const data = await api.get(`/api/materiales?sku=${encodeURIComponent(sku)}`);
        setSkuOptions(data);
      } catch (err) {
        console.error("Error en el fetch de materiales por SKU:", err);
        setSkuOptions([]);
      } finally {
        setSkuLoading(false);
      }
    };

    buscarMaterialesPorSku(debouncedSkuSearchTerm);
  }, [debouncedSkuSearchTerm]);

  const handleMaterialChange = async (selectedOption, fieldOnChange, index) => {
    // Se actualiza el valor del campo 'material' en el formulario
    fieldOnChange(selectedOption);
    
    // Si se deselecciona un material, se limpia la unidad
    if (!selectedOption) {
      setValue(`items.${index}.unidad`, '');
      return;
    }
    
    // Si se selecciona un material, se busca su unidad
    setUnidadesLoading(prev => ({ ...prev, [index]: true }));
    try {
      const materialDetails = await api.get(`/api/materiales/${selectedOption.id}`);
      setValue(`items.${index}.unidad`, materialDetails.unidad || 'N/A');
    } catch (error) {
      console.error(`Error al obtener unidad para material ${selectedOption.id}:`, error);
      setValue(`items.${index}.unidad`, 'Error');
    } finally {
      setUnidadesLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  return {
    materialesOptions,
    loading,
    skuOptions,
    skuLoading,
    unidadesLoading,
    searchTerm,
    setSearchTerm,
    skuSearchTerm,
    setSkuSearchTerm,
    handleMaterialChange,
  };
}
