//C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js
import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

const toYYYYMMDD = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

export const useAutorizaciones = () => {
  const [ocsPorAutorizar, setOcsPorAutorizar] = useState([]);
  const [ocsSpeiConfirmar, setOcsSpeiConfirmar] = useState([]);
  const [ocsPorLiquidar, setOcsPorLiquidar] = useState([]);
  const [ocsEnHold, setOcsEnHold] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog crédito: ahora la fecha es editable
  const [dialogState, setDialogState] = useState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });

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
      setDialogState({ open: true, ocId, diasCredito: dias, fechaPago: fecha });
    } catch { toast.error('No se pudo obtener la información de crédito.'); }
  };

  const setFechaPagoCredito = (fecha) => {
    setDialogState((prev) => ({ ...prev, fechaPago: fecha }));
  };

  const confirmarAprobacionCredito = async () => {
    const { ocId, fechaPago } = dialogState;
    if (!ocId) return;
    try {
      const payload = { fecha_vencimiento_pago: toYYYYMMDD(fechaPago) };
      const resp = await api.post(`/api/finanzas/oc/${ocId}/aprobar-credito`, payload);
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

  // === PAGOS ===
  const subirComprobantePago = async (ocId, { archivo, tipoPago, monto, comentario, fuentePagoId, fechaCompromisoPago }) => {
    const fd = new FormData();
    fd.append('comprobante', archivo);

    const t = (tipoPago || '').toString().toUpperCase();
    const tipoCanonico = t === 'PARCIAL' ? 'ANTICIPO' : t;
    fd.append('tipo_pago', tipoCanonico);

    fd.append('fuente_pago_id', String(fuentePagoId || ''));

    if (tipoCanonico !== 'TOTAL') {
      const montoStr = String(monto ?? '').replace(',', '.').trim();
      fd.append('monto', montoStr);

      // requerida para ANTICIPO
      fd.append('fecha_compromiso_pago', String(fechaCompromisoPago || ''));
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

  const getOcPreview = async (ocId) => {
    try { return await api.get(`/api/finanzas/oc/${ocId}/preview`); }
    catch { toast.error('No se pudo obtener la previsualización.'); return null; }
  };

  return {
    ocs: ocsPorAutorizar,
    speiPorConfirmar: ocsSpeiConfirmar,
    porLiquidar: ocsPorLiquidar,
    enHold: ocsEnHold,
    loading, error,

    dialogState,
    iniciarAprobacionCredito,
    setFechaPagoCredito,
    confirmarAprobacionCredito,
    cerrarDialogo,

    preautorizarSpei,
    cancelarSpei,

    rechazarOC,
    holdOC,
    reanudarOC,

    subirComprobantePago,

    getOcPreview,
  };
};
