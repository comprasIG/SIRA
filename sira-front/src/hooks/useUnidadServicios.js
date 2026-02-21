// sira-front/src/hooks/useUnidadServicios.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useUnidadServicios = () => {
  // Tipos de evento vienen de la BD: cada uno trae genera_requisicion, requiere_num_serie,
  // km_intervalo, tipo_combustible_aplica, material_sku.
  // Ya NO hay arreglos hardcodeados en el frontend.
  const [eventoTipos, setEventoTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEventoTipos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/unidades/evento-tipos');
      setEventoTipos(data);
    } catch (error) {
      console.error("Error al cargar tipos de evento:", error);
      toast.error(error?.error || 'Error al cargar tipos de evento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventoTipos();
  }, [fetchEventoTipos]);

  const crearRequisicion = async (payload) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/unidades/requisicion', payload);
      toast.success(data.mensaje || 'Requisición creada con éxito.');
      setIsSubmitting(false);
      return true;
    } catch (error) {
      console.error("Error al crear requisición vehicular:", error);
      toast.error(error?.error || error?.detalle || 'No se pudo crear la requisición.');
      setIsSubmitting(false);
      return false;
    }
  };

  const agregarRegistroManual = async (payload) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/unidades/historial/manual', payload);
      toast.success(data.mensaje || 'Registro agregado a la bitácora.');
      setIsSubmitting(false);
      return true;
    } catch (error) {
      console.error("Error al agregar registro manual:", error);
      toast.error(error?.error || error?.detalle || 'No se pudo agregar el registro.');
      setIsSubmitting(false);
      return false;
    }
  };

  const crearEventoTipo = async ({ nombre, descripcion, requiere_num_serie }) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/unidades/evento-tipos', { nombre, descripcion, requiere_num_serie });
      toast.success(`Tipo de evento "${data.nombre}" creado.`);
      await fetchEventoTipos();
      setIsSubmitting(false);
      return data;
    } catch (error) {
      console.error("Error al crear tipo de evento:", error);
      toast.error(error?.error || 'No se pudo crear el tipo de evento.');
      setIsSubmitting(false);
      return null;
    }
  };

  const cerrarAlerta = async (historialId) => {
    setIsSubmitting(true);
    try {
      const data = await api.patch(`/api/unidades/alertas/${historialId}/cerrar`, {});
      toast.success(data.mensaje || 'Alerta cerrada.');
      setIsSubmitting(false);
      return true;
    } catch (error) {
      console.error("Error al cerrar alerta:", error);
      toast.error(error?.error || 'No se pudo cerrar la alerta.');
      setIsSubmitting(false);
      return false;
    }
  };

  return {
    eventoTipos,
    loadingEventoTipos: loading,
    isSubmitting,
    refetchEventoTipos: fetchEventoTipos,
    crearRequisicion,
    agregarRegistroManual,
    crearEventoTipo,
    cerrarAlerta,
  };
};
