// sira-front/src/hooks/useIncrementables.js
/**
 * Hook centralizado para el módulo de Incrementables de Importación.
 * Gestiona:
 *   - lista de OC incrementables
 *   - datos iniciales (tipos, ocs_impo, proveedores, monedas)
 *   - creación de nueva OC incrementable
 *   - preview de distribución proporcional
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useIncrementables = () => {
  const [incrementables,  setIncrementables]  = useState([]);
  const [datosIniciales,  setDatosIniciales]  = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [loadingIniciales, setLoadingIniciales] = useState(false);
  const [isSubmitting,    setIsSubmitting]    = useState(false);

  // ─── Lista de incrementables ───────────────────────────────────────────────
  const fetchIncrementables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/incrementables/');
      setIncrementables(data);
    } catch (err) {
      console.error('[useIncrementables] Error al cargar incrementables:', err);
      toast.error(err?.error || 'No se pudieron cargar los incrementables.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Datos iniciales (tipos, ocs IMPO, proveedores, monedas) ──────────────
  const fetchDatosIniciales = useCallback(async () => {
    setLoadingIniciales(true);
    try {
      const data = await api.get('/api/incrementables/datos-iniciales');
      setDatosIniciales(data);
    } catch (err) {
      console.error('[useIncrementables] Error al cargar datos iniciales:', err);
      toast.error(err?.error || 'No se pudieron cargar los datos del formulario.');
    } finally {
      setLoadingIniciales(false);
    }
  }, []);

  // ─── Preview distribución (sin guardar) ───────────────────────────────────
  const previewDistribucion = useCallback(async ({ oc_base_ids, tipo_cambios, monto_total, moneda_incrementable }) => {
    try {
      const params = new URLSearchParams();
      oc_base_ids.forEach(id => params.append('oc_base_ids', id));
      if (tipo_cambios) params.set('tipo_cambios', JSON.stringify(tipo_cambios));
      if (monto_total)  params.set('monto_total', monto_total);
      if (moneda_incrementable) params.set('moneda_incrementable', moneda_incrementable);

      const data = await api.get(`/api/incrementables/0/preview-distribucion?${params.toString()}`);
      return data;
    } catch (err) {
      console.error('[useIncrementables] Error en preview distribución:', err);
      toast.error(err?.error || 'No se pudo calcular la distribución.');
      return [];
    }
  }, []);

  // ─── Crear OC incrementable ────────────────────────────────────────────────
  const crearIncrementable = useCallback(async (payload) => {
    setIsSubmitting(true);
    try {
      const result = await api.post('/api/incrementables/crear', payload);
      toast.success(`OC incrementable creada: ${result.numero_oc}`);
      await fetchIncrementables();
      return result;
    } catch (err) {
      console.error('[useIncrementables] Error al crear incrementable:', err);
      const msg = err?.error || err?.message || 'Error al crear la OC incrementable.';
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchIncrementables]);

  // ─── Cerrar incrementable (REC_OC) ────────────────────────────────────────
  const cerrarIncrementable = useCallback(async (ocId) => {
    setIsSubmitting(true);
    try {
      const result = await api.post(`/api/recoleccion/ocs/${ocId}/cerrar-incrementable`, {});
      toast.success(result.mensaje || 'OC incrementable cerrada y costos aplicados al inventario.');
      await fetchIncrementables();
      return result;
    } catch (err) {
      console.error('[useIncrementables] Error al cerrar incrementable:', err);
      const msg = err?.error || err?.message || 'Error al cerrar la OC incrementable.';
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchIncrementables]);

  // ─── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchIncrementables();
  }, [fetchIncrementables]);

  // KPIs derivados
  const kpis = {
    porAutorizar: incrementables.filter(i => i.status === 'POR_AUTORIZAR').length,
    aprobadas:    incrementables.filter(i => ['APROBADA', 'EN_PROCESO', 'CONFIRMAR_SPEI'].includes(i.status)).length,
    cerradas:     incrementables.filter(i => i.status === 'ENTREGADA').length,
  };

  return {
    incrementables,
    datosIniciales,
    loading,
    loadingIniciales,
    isSubmitting,
    kpis,
    fetchIncrementables,
    fetchDatosIniciales,
    previewDistribucion,
    crearIncrementable,
    cerrarIncrementable,
  };
};
