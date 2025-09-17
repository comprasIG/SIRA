// C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js
import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

const dedupeById = (arr = []) => {
  const map = new Map();
  for (const it of arr) if (it && typeof it.id !== 'undefined' && !map.has(it.id)) map.set(it.id, it);
  return Array.from(map.values());
};

const safeGetArray = async (path) => {
  try { const data = await api.get(path); return Array.isArray(data) ? data : []; }
  catch { return []; }
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
  const [dialogState, setDialogState] = useState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });

  // === FETCHERS ===
  const fetchPorAutorizar = useCallback(async () => safeGetArray('/api/finanzas/ocs/por-autorizar'), []);
  const fetchSpeiPorConfirmar = useCallback(async () => {
    const candidates = [
      '/api/finanzas/ocs/confirmar-spei',
      '/api/finanzas/ocs/pendientes-spei',
      '/api/finanzas/ocs?status=CONFIRMAR_SPEI',
      '/api/finanzas/ocs/estado/CONFIRMAR_SPEI',
      '/api/finanzas/ocs/todas',
    ];
    const results = await Promise.all(candidates.map(safeGetArray));
    let merged = dedupeById(results.flat());
    if (merged.length) merged = merged.filter(oc => oc?.metodo_pago === 'SPEI' && oc?.status === 'CONFIRMAR_SPEI');
    return merged;
  }, []);
  const fetchPorLiquidar = useCallback(async () => {
    const candidates = ['/api/finanzas/ocs/por-liquidar', '/api/finanzas/ocs/pendientes-liquidacion', '/api/finanzas/ocs?pendiente_liquidar=true', '/api/finanzas/ocs/todas'];
    const results = await Promise.all(candidates.map(safeGetArray));
    let merged = dedupeById(results.flat());
    if (merged.length) {
      merged = merged.filter(oc => (!!oc?.pendiente_liquidar) && (oc?.metodo_pago === 'CREDITO' || (oc?.metodo_pago === 'SPEI' && oc?.status === 'APROBADA')));
    }
    return merged;
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [porAutorizar, speiConfirmar, porLiqui] = await Promise.all([fetchPorAutorizar(), fetchSpeiPorConfirmar(), fetchPorLiquidar()]);
      setOcsPorAutorizar(porAutorizar); setOcsSpeiConfirmar(speiConfirmar); setOcsPorLiquidar(porLiqui);
    } catch (err) {
      setError('No se pudieron cargar las órdenes de compra.'); toast.error(err?.error || 'Error al cargar datos.');
    } finally { setLoading(false); }
  }, [fetchPorAutorizar, fetchSpeiPorConfirmar, fetchPorLiquidar]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === CRÉDITO ===
  const iniciarAprobacionCredito = async (ocId) => {
    try {
      const { dias_credito } = await api.get(`/api/finanzas/oc/${ocId}/detalles-credito`);
      const dias = dias_credito > 0 ? dias_credito : 15;
      const fecha = new Date(); fecha.setDate(fecha.getDate() + dias);
      setDialogState({ open: true, ocId, diasCredito: dias_credito, fechaPago: fecha });
    } catch { toast.error('No se pudo obtener la información de crédito.'); }
  };
  const confirmarAprobacionCredito = async () => {
    const { ocId } = dialogState; if (!ocId) return;
    try {
      toast.info('Procesando aprobación…');
      const resp = await api.post(`/api/finanzas/oc/${ocId}/aprobar-credito`);
      setOcsPorAutorizar(prev => prev.filter(o => o.id !== ocId));
      setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });
      toast.success(resp?.mensaje || 'OC aprobada a crédito.');
      await fetchAll();
    } catch (err) { toast.error(err?.error || 'No se pudo aprobar la OC.'); }
  };
  const cerrarDialogo = () => setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });

  // === CONTADO / SPEI ===
  const preautorizarSpei = async (ocId) => {
    try { toast.info('Marcando OC para SPEI…'); await api.post(`/api/finanzas/oc/${ocId}/preautorizar-spei`); await fetchAll(); toast.success('OC marcada como de contado (SPEI).'); }
    catch (err) { toast.error(err?.error || 'No se pudo pre-autorizar la OC.'); }
  };
  const cancelarSpei = async (ocId) => {
    try { toast.info('Cancelando pre-autorización SPEI…'); await api.post(`/api/finanzas/oc/${ocId}/cancelar-spei`); await fetchAll(); toast.success('Pre-autorización SPEI cancelada.'); }
    catch (err) { toast.error(err?.error || 'No se pudo cancelar la pre-autorización SPEI.'); }
  };

  // === HOLD & RECHAZO ===
  const rechazarOC = async (ocId, motivo) => {
    try { if (!motivo?.trim()) throw new Error('Escribe un motivo.'); await api.post(`/api/finanzas/oc/${ocId}/rechazar`, { motivo }); toast.success('OC rechazada.'); await fetchAll(); }
    catch (err) { toast.error(err?.error || err?.message || 'No se pudo rechazar la OC.'); }
  };
  const holdOC = async (ocId, regresarEn) => {
    try { await api.post(`/api/finanzas/oc/${ocId}/hold`, { regresar_en: regresarEn || null }); toast.success('OC puesta en hold.'); await fetchAll(); }
    catch (err) { toast.error(err?.error || 'No se pudo poner la OC en hold.'); }
  };
  const reanudarOC = async (ocId) => {
    try { await api.post(`/api/finanzas/oc/${ocId}/reanudar`); toast.success('OC reanudada.'); await fetchAll(); }
    catch (err) { toast.error(err?.error || 'No se pudo reanudar la OC.'); }
  };

  // === PREVIEW ===
  const getOcPreview = async (ocId) => {
    try { return await api.get(`/api/finanzas/oc/${ocId}/preview`); }
    catch { toast.error('No se pudo obtener la previsualización.'); return null; }
  };

  // Exponer API del hook
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
    // hold & rechazo
    rechazarOC, holdOC, reanudarOC,
    // pagos
    subirComprobantePago: async (ocId, { archivo, tipoPago, monto, comentario }) => {
      const fd = new FormData(); fd.append('comprobante', archivo); fd.append('tipo_pago', tipoPago); fd.append('monto', monto); if (comentario) fd.append('comentario', comentario);
      try { const resp = await api.post(`/api/finanzas/oc/${ocId}/pagos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); await fetchAll(); return resp; }
      catch (err) { toast.error(err?.error || 'Error al subir el comprobante.'); throw err; }
    },
    // preview
    getOcPreview,
  };
};
