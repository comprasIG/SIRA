// src/components/REC_OC/hooks/useRecOcList.js
import { useEffect, useState } from 'react';
import api from '../../../api/api';

export default function useRecOcList(filtros, reload, tipo = "pendientes") {
  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async()=>{
      setLoading(true);
      try {
        const res = await api.get(`/api/rec_oc/${tipo}`, { params: filtros });
        const data = Array.isArray(res) ? res : res.data;
        alive && setOcs(Array.isArray(data) ? data : []);
      } catch {
        alive && setOcs([]);
      } finally {
        alive && setLoading(false);
      }
    })();
    return ()=>{ alive = false; };
  }, [JSON.stringify(filtros), reload, tipo]);

  return { ocs, loading };
}
