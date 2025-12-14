// sira-front/src/hooks/useUnidadServicios.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useUnidadServicios = () => {
  const [datosModal, setDatosModal] = useState({ tiposDeEvento: [], materialesMap: {} });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Cargar los datos para llenar los <select> del modal
  const fetchDatosModal = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/unidades/datos-modal-servicio');
      setDatosModal(data);
    } catch (error) {
      console.error("Error al cargar datos del modal:", error);
      toast.error(error?.error || 'Error al cargar datos para el modal.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Ejecutar la carga al iniciar el hook
  useEffect(() => {
    fetchDatosModal();
  }, [fetchDatosModal]);

  // 3. Función para ENVIAR la nueva requisición
  const crearRequisicion = async (payload) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/unidades/requisicion', payload);
      toast.success(data.mensaje || 'Requisición creada con éxito.');
      setIsSubmitting(false);
      return true; // Éxito
    } catch (error) {
      console.error("Error al crear requisición vehicular:", error);
      toast.error(error?.error || 'No se pudo crear la requisición.');
      setIsSubmitting(false);
      return false; // Fracaso
    }
  };
  // 4. Función para ENVIAR un registro manual a la bitácora
  // Para agregar un registro manual (gasolina, incidencia, etc.)
  const agregarRegistroManual = async (payload) => {
    setIsSubmitting(true);
    try {
      const data = await api.post('/api/unidades/historial/manual', payload);
      toast.success(data.mensaje || 'Registro agregado a la bitácora.');
      setIsSubmitting(false);
      return true; // Éxito
    } catch (error) {
      console.error("Error al agregar registro manual:", error);
      toast.error(error?.error || 'No se pudo agregar el registro.');
      setIsSubmitting(false);
      return false; // Fracaso
    }
  };
  // ===================================

  return {
    datosModal,
    loadingDatosModal: loading,
    isSubmitting,
    crearRequisicion,
    agregarRegistroManual, // <<< ¡NUEVA FUNCIÓN EXPORTADA!
  };
};