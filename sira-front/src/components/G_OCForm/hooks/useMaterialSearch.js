// C:\SIRA\sira-front\src\components\G_OCForm\hooks\useMaterialSearch.js
import { useEffect, useMemo, useState } from 'react';
import debounce from 'lodash.debounce';
import api from '../../../api/api';

export function useMaterialSearch() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useMemo(
    () =>
      debounce(async (query) => {
        if (!query || query.trim().length < 2) {
          setOptions([]);
          return;
        }
        setLoading(true);
        try {
          const data = await api.get(`/api/materiales?query=${encodeURIComponent(query)}`);
          setOptions(data || []);
        } catch (error) {
          console.error('[ExtraOC] Error buscando materiales:', error);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, 400),
    []
  );

  useEffect(() => () => search.cancel(), [search]);

  return { options, loading, search };
}
