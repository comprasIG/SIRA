// C:\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js

import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

const dedupeById = (arr = []) => {
  const map = new Map();
  for (const it of arr) if (it && typeof it.id !== 'undefined' && !map.has(it.id)) map.set(it.id, it);
  return Array.from(map.values());
};

const safeGetArray = async (path) => {
  try {
    const data = await api.get(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const useAutorizaciones = () => {
  // Listas
  const [ocsPorAutorizar, setOcsPorAutorizar] = useState([]);     // POR_AUTORIZAR
  const [ocsSpeiConfirmar, setOcsSpeiConfirmar] = useState([]);   // SPEI en CONFIRMAR_SPEI
  const [ocsPorLiquidar, setOcsPorLiquidar] = useState([]);       // Crédito y SPEI (APROBADA) con pendiente_liquidar

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog crédito
  const [dialogState, setDialogState] = useState({
    open: false,
    ocId: null,
    diasCredito: 0,
    fechaPago: null,
  });

  // === FETCHERS ===

  // 1) Por autorizar
  const fetchPorAutorizar = useCallback(async () => {
    return safeGetArray('/api/finanzas/ocs/por-autorizar');
  }, []);

  // 2) SPEI por confirmar (CONFIRMAR_SPEI)
  const fetchSpeiPorConfirmar = useCallback(async () => {
    const candidates = [
      '/api/finanzas/ocs/pendientes-spei',
      '/api/finanzas/ocs/confirmar-spei',
      '/api/finanzas/ocs?status=CONFIRMAR_SPEI',
      '/api/finanzas/ocs/estado/CONFIRMAR_SPEI',
      '/api/finanzas/ocs/todas', // fallback: filtramos nosotros
    ];
    const results = await Promise.all(candidates.map(safeGetArray));
    let merged = dedupeById(results.flat());
    if (merged.length) {
      merged = merged.filter(oc => oc?.metodo_pago === 'SPEI' && oc?.status === 'CONFIRMAR_SPEI');
    }
    return merged;
  }, []);

  // 3) Por liquidar (crédito y SPEI aprobadas con pendiente_liquidar)
  const fetchPorLiquidar = useCallback(async () => {
    const candidates = [
      '/api/finanzas/ocs/por-liquidar',
      '/api/finanzas/ocs/pendientes-liquidacion',
      '/api/finanzas/ocs?pendiente_liquidar=true',
      '/api/finanzas/ocs/todas', // fallback
    ];
    const results = await Promise.all(candidates.map(safeGetArray));
    let merged = dedupeById(results.flat());

    if (merged.length) {
      merged = merged.filter(oc =>
        (!!oc?.pendiente_liquidar) && (
          oc?.metodo_pago === 'CREDITO' ||
          (oc?.metodo_pago === 'SPEI' && oc?.status === 'APROBADA')
        )
      );
    }
    return merged;
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [porAutorizar, speiConfirmar, porLiqui] = await Promise.all([
        fetchPorAutorizar(),
        fetchSpeiPorConfirmar(),
        fetchPorLiquidar(),
      ]);
      setOcsPorAutorizar(porAutorizar);
      setOcsSpeiConfirmar(speiConfirmar);
      setOcsPorLiquidar(porLiqui);
    } catch (err) {
      setError('No se pudieron cargar las órdenes de compra.');
      toast.error(err?.error || 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  }, [fetchPorAutorizar, fetchSpeiPorConfirmar, fetchPorLiquidar]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === CRÉDITO ===
  const iniciarAprobacionCredito = async (ocId) => {
    try {
      const { dias_credito } = await api.get(`/api/finanzas/oc/${ocId}/detalles-credito`);
      const dias = dias_credito > 0 ? dias_credito : 15;
      const fecha = new Date(); fecha.setDate(fecha.getDate() + dias);
      setDialogState({ open: true, ocId, diasCredito: dias_credito, fechaPago: fecha });
    } catch {
      toast.error('No se pudo obtener la información de crédito.');
    }
  };

  const confirmarAprobacionCredito = async () => {
    const { ocId } = dialogState; if (!ocId) return;
    try {
      toast.info('Procesando aprobación…');
      const resp = await api.post(`/api/finanzas/oc/${ocId}/aprobar-credito`);
      // saca de "por autorizar"
      setOcsPorAutorizar(prev => prev.filter(o => o.id !== ocId));
      setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });
      toast.success(resp?.mensaje || 'OC aprobada a crédito.');
      // refresh por si afecta "por liquidar"
      await fetchAll();
    } catch (err) {
      toast.error(err?.error || 'No se pudo aprobar la OC.');
    }
  };

  const cerrarDialogo = () => setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });

  // === CONTADO / SPEI ===
  // Nota: NO se pide archivo aquí; solo pasa a CONFIRMAR_SPEI
  const preautorizarSpei = async (ocId) => {
    try {
      toast.info('Marcando OC para pago SPEI…');
      await api.post(`/api/finanzas/oc/${ocId}/preautorizar-spei`);
      await fetchAll();
      toast.success('OC marcada como de contado (SPEI). Sube el comprobante desde la pestaña “SPEI POR CONFIRMAR”.');
    } catch (err) {
      toast.error(err?.error || 'No se pudo pre-autorizar la OC.');
    }
  };

  // Cancelar SPEI (revertir a POR_AUTORIZAR o al estado previo)
  const cancelarSpei = async (ocId) => {
    try {
      toast.info('Cancelando pre-autorización SPEI…');
      // usa tu endpoint real si es distinto
      await api.post(`/api/finanzas/oc/${ocId}/cancelar-spei`);
      await fetchAll();
      toast.success('Pre-autorización SPEI cancelada.');
    } catch (err) {
      toast.error(err?.error || 'No se pudo cancelar la pre-autorización SPEI.');
    }
  };

  // === SUBIR COMPROBANTE ===
  const subirComprobantePago = async (ocId, { archivo, tipoPago, monto, comentario }) => {
    const formData = new FormData();
    formData.append('comprobante', archivo);
    formData.append('tipo_pago', tipoPago); // TOTAL o ANTICIPO
    formData.append('monto', monto);
    if (comentario) formData.append('comentario', comentario);
    try {
      toast.info('Subiendo comprobante…');
      const resp = await api.post(`/api/finanzas/oc/${ocId}/pagos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchAll();
      toast.success(resp?.mensaje || 'Comprobante registrado.');
    } catch (err) {
      toast.error(err?.error || 'Error al subir el comprobante.');
    }
  };

  return {
    // listas
    ocs: ocsPorAutorizar,
    speiPorConfirmar: ocsSpeiConfirmar,
    porLiquidar: ocsPorLiquidar,

    // ui
    loading, error,

    // crédito
    dialogState, iniciarAprobacionCredito, confirmarAprobacionCredito, cerrarDialogo,

    // contado
    preautorizarSpei, cancelarSpei,

    // pagos
    subirComprobantePago,
  };
};
