// sira-front/src/hooks/useGasolina.js
/**
 * Hook centralizado para el módulo de Gasolina.
 * Gestiona:
 *   - cargas (fin_gasolina_cargas)
 *   - pagos  (fin_gasolina_pagos)
 *   - fuentes de pago (catalogo_fuentes_pago)
 *   - unidades (para el selector en ModalRegistrarCarga)
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useGasolina = () => {
  const [cargas,        setCargas]        = useState([]);
  const [pagos,         setPagos]         = useState([]);
  const [fuentesPago,   setFuentesPago]   = useState([]);
  const [unidades,      setUnidades]      = useState([]);
  const [sitios,        setSitios]        = useState([]);
  const [proyectos,     setProyectos]     = useState([]);

  const [loadingCargas,  setLoadingCargas]  = useState(false);
  const [loadingPagos,   setLoadingPagos]   = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [isSubmitting,   setIsSubmitting]   = useState(false);

  // ─── Cargas ───────────────────────────────────────────────────────────────
  const fetchCargas = useCallback(async (filtros = {}) => {
    setLoadingCargas(true);
    try {
      const params = new URLSearchParams();
      if (filtros.pagado !== undefined && filtros.pagado !== '')
        params.set('pagado', filtros.pagado);
      if (filtros.unidad_id)   params.set('unidad_id',   filtros.unidad_id);
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta);

      const qs = params.toString();
      const data = await api.get(`/api/finanzas/gasolina/cargas${qs ? `?${qs}` : ''}`);
      setCargas(data);
    } catch (err) {
      console.error('Error al cargar cargas de gasolina:', err);
      toast.error(err?.error || 'No se pudieron cargar las cargas de gasolina.');
    } finally {
      setLoadingCargas(false);
    }
  }, []);

  // ─── Pagos ────────────────────────────────────────────────────────────────
  const fetchPagos = useCallback(async () => {
    setLoadingPagos(true);
    try {
      const data = await api.get('/api/finanzas/gasolina/pagos');
      setPagos(data);
    } catch (err) {
      console.error('Error al cargar pagos de gasolina:', err);
      toast.error(err?.error || 'No se pudieron cargar los pagos.');
    } finally {
      setLoadingPagos(false);
    }
  }, []);

  // ─── Catálogos (fuentes, unidades, sitios, proyectos) ─────────────────────
  const fetchCatalogos = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [fuentesData, unidadesData, sitiosData, proyectosData] = await Promise.all([
        api.get('/api/finanzas/fuentes-pago?soloActivas=true'),
        api.get('/api/unidades'),
        api.get('/api/sitios'),
        api.get('/api/proyectos'),
      ]);
      setFuentesPago(fuentesData);
      setUnidades(unidadesData);
      setSitios(sitiosData);
      setProyectos(proyectosData);
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
      toast.error(err?.error || 'No se pudieron cargar los catálogos.');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchCargas({ pagado: false }); // inicia mostrando pendientes
    fetchPagos();
    fetchCatalogos();
  }, [fetchCargas, fetchPagos, fetchCatalogos]);

  // ─── Mutaciones ───────────────────────────────────────────────────────────
  const fetchUnidades = useCallback(async () => {
    try {
      const data = await api.get('/api/unidades');
      setUnidades(data);
    } catch (err) {
      console.error('Error al refrescar unidades:', err);
    }
  }, []);

  const crearCarga = async (payload) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/finanzas/gasolina/cargas', payload);
      toast.success(data.mensaje || 'Carga registrada correctamente.');
      await Promise.all([fetchCargas({ pagado: false }), fetchUnidades()]);
      return true;
    } catch (err) {
      console.error('Error al crear carga de gasolina:', err);
      toast.error(err?.error || 'No se pudo registrar la carga.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const crearPago = async (payload) => {
    setIsSubmitting(true);
    try {
      // Construir FormData para soportar upload de archivo (comprobante)
      const fd = new FormData();
      fd.append('fuente_pago_id', String(payload.fuente_pago_id));
      fd.append('carga_ids', JSON.stringify(payload.carga_ids));
      if (payload.fecha_pago) fd.append('fecha_pago', payload.fecha_pago);
      if (payload.comentario) fd.append('comentario', payload.comentario);
      if (payload.archivo)    fd.append('comprobante', payload.archivo);

      const data = await api.post('/api/finanzas/gasolina/pagos', fd);
      toast.success(data.mensaje || 'Pago registrado correctamente.');
      await Promise.all([fetchCargas({ pagado: false }), fetchPagos()]);
      return true;
    } catch (err) {
      console.error('Error al registrar pago de gasolina:', err);
      toast.error(err?.error || 'No se pudo registrar el pago.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // Datos
    cargas,
    pagos,
    fuentesPago,
    unidades,
    sitios,
    proyectos,
    // Estados de carga
    loadingCargas,
    loadingPagos,
    loadingCatalog,
    isSubmitting,
    // Acciones
    fetchCargas,
    fetchPagos,
    fetchUnidades,
    crearCarga,
    crearPago,
  };
};
