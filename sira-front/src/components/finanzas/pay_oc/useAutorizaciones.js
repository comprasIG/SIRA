//C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js
import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

export const useAutorizaciones = () => {
  // Listas
  const [ocsPorAutorizar, setOcsPorAutorizar] = useState([]);
  const [ocsSpeiConfirmar, setOcsSpeiConfirmar] = useState([]);
  const [ocsPorLiquidar, setOcsPorLiquidar] = useState([]);
  const [ocsEnHold, setOcsEnHold] = useState([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog crédito
  const [dialogState, setDialogState] = useState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });

  // === FETCHERS ===
  const fetchPorAutorizar = useCallback(async () => {
    try { return await api.get('/api/finanzas/ocs/por-autorizar'); }
    catch { toast.error('No se pudieron cargar OCs por autorizar.'); return []; }
  }, []);

  const fetchSpeiPorConfirmar = useCallback(async () => {
    try { return await api.get('/api/finanzas/ocs/confirmar-spei'); }
    catch { toast.error('No se pudieron cargar SPEI por confirmar.'); return []; }
  }, []);

  const fetchPorLiquidar = useCallback(async () => {
    try { return await api.get('/api/finanzas/ocs/por-liquidar'); }
    catch { toast.error('No se pudieron cargar OCs por liquidar.'); return []; }
  }, []);

  const fetchEnHold = useCallback(async () => {
    try { return await api.get('/api/finanzas/ocs/en-hold'); }
    catch { toast.error('No se pudieron cargar OCs en HOLD.'); return []; }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [pa, sc, pl, eh] = await Promise.all([
        fetchPorAutorizar(),
        fetchSpeiPorConfirmar(),
        fetchPorLiquidar(),
        fetchEnHold()
      ]);
      setOcsPorAutorizar(pa || []);
      setOcsSpeiConfirmar(sc || []);
      setOcsPorLiquidar(pl || []);
      setOcsEnHold(eh || []);
    } catch {
      setError('No se pudieron cargar las órdenes de compra.');
    } finally { setLoading(false); }
  }, [fetchPorAutorizar, fetchSpeiPorConfirmar, fetchPorLiquidar, fetchEnHold]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === CRÉDITO ===
  const iniciarAprobacionCredito = async (ocId) => {
    try {
      const { dias_credito } = await api.get(`/api/finanzas/oc/${ocId}/detalles-credito`);
      const dias = dias_credito > 0 ? dias_credito : 30;
      const fecha = new Date(); fecha.setDate(fecha.getDate() + dias);
      setDialogState({ open: true, ocId, diasCredito: dias_credito, fechaPago: fecha });
    } catch { toast.error('No se pudo obtener la información de crédito.'); }
  };

  const confirmarAprobacionCredito = async () => {
    const { ocId } = dialogState; if (!ocId) return;
    try {
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
    try { await api.post(`/api/finanzas/oc/${ocId}/preautorizar-spei`); await fetchAll(); toast.success('OC marcada como de contado (SPEI).'); }
    catch (err) { toast.error(err?.error || 'No se pudo pre-autorizar la OC.'); }
  };

  const cancelarSpei = async (ocId) => {
    try { await api.post(`/api/finanzas/oc/${ocId}/cancelar-spei`); await fetchAll(); toast.success('Pre-autorización SPEI cancelada.'); }
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

  // === PAGOS (comprobantes) ===
  const subirComprobantePago = async (ocId, { archivo, tipoPago, monto, comentario, fuentePagoId }) => {
    const fuenteIdNum = Number(fuentePagoId);
    if (!Number.isInteger(fuenteIdNum) || fuenteIdNum <= 0) {
      toast.error('Selecciona una fuente de pago válida.');
      throw { error: 'fuente_pago_id es obligatorio y debe ser numérico.', status: 400 };
    }

    const fd = new FormData();
    fd.append('comprobante', archivo);

    // Mapea defensivo (por si en algún flujo llega "PARCIAL")
    const t = (tipoPago || '').toString().toUpperCase();
    const tipoCanonico = t === 'PARCIAL' ? 'ANTICIPO' : t;
    fd.append('tipo_pago', tipoCanonico); // 'TOTAL' | 'ANTICIPO'

    // ✅ fuente de pago
    fd.append('fuente_pago_id', String(fuenteIdNum));

    // Si no es TOTAL, mandamos SIEMPRE monto
    if (tipoCanonico !== 'TOTAL') {
      const montoStr = String(monto ?? '').replace(',', '.').trim();
      fd.append('monto', montoStr);
    }

    if (comentario) fd.append('comentario', comentario);

    try {
      const resp = await api.post(`/api/finanzas/oc/${ocId}/pagos`, fd);
      await fetchAll();
      return resp;
    } catch (err) {
      toast.error(err?.error || 'Error al subir el comprobante.');
      throw err;
    }
  };

  // === PREVIEW ===
  const getOcPreview = async (ocId) => {
    try { return await api.get(`/api/finanzas/oc/${ocId}/preview`); }
    catch { toast.error('No se pudo obtener la previsualización.'); return null; }
  };

  return {
    // listas
    ocs: ocsPorAutorizar,
    speiPorConfirmar: ocsSpeiConfirmar,
    porLiquidar: ocsPorLiquidar,
    enHold: ocsEnHold,
    // ui
    loading, error,
    // crédito
    dialogState, iniciarAprobacionCredito, confirmarAprobacionCredito, cerrarDialogo,
    // contado
    preautorizarSpei, cancelarSpei,
    // hold & rechazo
    rechazarOC, holdOC, reanudarOC,
    // pagos
    subirComprobantePago,
    // preview
    getOcPreview,
  };
};
