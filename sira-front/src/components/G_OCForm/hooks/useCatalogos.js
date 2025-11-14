// C:\SIRA\sira-front\src\components\G_OCForm\hooks\useCatalogos.js
import { useEffect, useState } from 'react';
import api from '../../../api/api';

export function useCatalogosExtraOc() {
  const [catalogos, setCatalogos] = useState({ sitios: [], proyectos: [], proveedores: [], unidades: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCatalogos = async () => {
      setLoading(true);
      try {
        const data = await api.get('/api/oc-extra/catalogos');
        if (!isMounted) return;
        setCatalogos({
          sitios: data?.sitios || [],
          proyectos: data?.proyectos || [],
          proveedores: data?.proveedores || [],
          unidades: data?.unidades || [],
        });
      } catch (err) {
        if (isMounted) setError(err?.error || 'No fue posible cargar los catálogos.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCatalogos();
    return () => { isMounted = false; };
  }, []);

  return { catalogos, loading, error };
}
