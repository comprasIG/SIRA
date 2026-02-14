// C:\SIRA\sira-front\src\components\G_REQForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from 'react-toastify';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import api from "../api/api";
import { useAuth } from "../context/authContext";
import { useAutoSave } from "./G_REQForm/hooks/useAutoSave";

// UI
import DatosGenerales from "./G_REQForm/DatosGenerales";
import SeccionMateriales from "./G_REQForm/SeccionMateriales";
import AccionesFormulario from "./G_REQForm/AccionesFormulario";

// Custom Hooks
import { useFormAttachments } from "./G_REQForm/hooks/useFormAttachments";
import { useInitialData } from "./G_REQForm/hooks/useInitialData";
import { useMaterialLogic } from "./G_REQForm/hooks/useMaterialLogic";
import { useFormValidation } from "./G_REQForm/hooks/useFormValidation";

// Constantes
const ALMACEN_ID = "21";
const DEFAULT_URGENCY_MESSAGE = "FAVOR DE INDICAR EL MOTIVO DE LA URGENCIA";

const startOfDay = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const addDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

function G_REQForm({ requisicionId, onFinish }) {
  // --- Contexto / Navegación ---
  const { usuario } = useAuth();
  const isEditMode = !!requisicionId;
  const navigate = useNavigate();

  // --- Estado local ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const defaultFechaRequerida = useMemo(() => {
    if (isEditMode) return "";
    const today = new Date();
    const nextWeek = addDays(today, 7);
    return toInputDate(nextWeek);
  }, [isEditMode]);

  const getDefaultValues = useMemo(() => ({
    items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
    proyecto_id: '', sitio_id: '', fecha_requerida: defaultFechaRequerida,
    lugar_entrega: ALMACEN_ID, comentario: '',
  }), [defaultFechaRequerida]);

  // --- React Hook Form ---
  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: getDefaultValues
  });

  const fechaRequerida = watch("fecha_requerida");
  const comentarioActual = watch("comentario");

  const isUrgent = useMemo(() => {
    if (!fechaRequerida) return false;
    const selectedDate = parseInputDate(fechaRequerida);
    if (!selectedDate) return false;

    const today = startOfDay(new Date());
    const requiredDate = startOfDay(selectedDate);
    const diffInMs = requiredDate.getTime() - today.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    return diffInDays >= 0 && diffInDays <= 1;
  }, [fechaRequerida]);

  // ELIMINADO: useEffect que forzaba el valor del comentario. Ahora se maneja con placeholder y validación.

  // --- Adjuntos (debe ir antes de autosave e initialData para exponer setters) ---
  const {
    archivosAdjuntos, setArchivosAdjuntos,
    archivosExistentes, setArchivosExistentes,
    handleFileChange, handleRemoveFile, handleRemoveExistingFile
  } = useFormAttachments();

  // --- Datos iniciales (catálogos/edición) ---
  const { proyectos, sitios, isLoading } = useInitialData(
    requisicionId,
    reset,
    setValue,
    setArchivosExistentes
  );

  // --- Auto-guardado (se ejecuta en creación; espera catálogos) ---
  const { clearDraft } = useAutoSave({
    isEditMode,
    watch,
    usuario,
    reset,
    setArchivosAdjuntos,
    setArchivosExistentes,
    enabled: !isLoading, // evita pisar defaults cuando aún cargan catálogos
  });

  // --- Materiales (buscador/unidades) ---
  const {
    materialesOptions,
    // skuOptions, (Eliminado)
    loading: loadingMaterials,
    // skuLoading, (Eliminado)
    unidadesLoading,
    setSearchTerm,
    // setSkuSearchTerm, (Eliminado)
    handleMaterialChange
  } = useMaterialLogic(setValue);

  // --- Validación (duplicados) ---
  const { duplicateMaterialIds } = useFormValidation(control);

  // --- Render helpers ---
  const selectedSitioId = watch("sitio_id");
  const selectedProyectoId = watch("proyecto_id"); // Obtenemos el ID del proyecto seleccionado

  const proyectosFiltrados = useMemo(() => {
    if (!selectedSitioId) return proyectos;
    return proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }, [selectedSitioId, proyectos]);

  // --- Handlers ---
  const handleSitioChange = (e) => {
    const newSitioId = e.target.value;
    setValue("sitio_id", newSitioId, { shouldValidate: true });

    const proyectosValidos = proyectos.filter(p => String(p.sitio_id) === newSitioId);
    if (!proyectosValidos.some(p => String(p.id) === String(watch("proyecto_id")))) {
      setValue("proyecto_id", "", { shouldValidate: true });
    }
    if (newSitioId === ALMACEN_ID) setValue("lugar_entrega", ALMACEN_ID);
  };

  const handleProyectoChange = (e) => {
    const newProyectoId = e.target.value;
    setValue("proyecto_id", newProyectoId, { shouldValidate: true });

    const proyecto = proyectos.find((p) => String(p.id) === newProyectoId);
    if (proyecto) {
      setValue("sitio_id", proyecto.sitio_id, { shouldValidate: true });
      if (String(proyecto.sitio_id) === ALMACEN_ID) setValue("lugar_entrega", ALMACEN_ID);
    }
  };

  const onClean = () => {
    reset(getDefaultValues);
    setArchivosAdjuntos([]);
    setArchivosExistentes([]);
  };

  // --- Submit ---
  const onSubmit = async (data) => {
    // Validaciones previas
    if (duplicateMaterialIds.size > 0) {
      toast.error("No puedes enviar la requisición porque contiene materiales duplicados.");
      return;
    }
    if (!data.items || data.items.some(item => !item.material || !item.cantidad)) {
      toast.error("Todos los materiales deben tener un producto y una cantidad seleccionados.");
      return;
    }

    setIsSubmitting(true);

    // Construcción de FormData
    const formData = new FormData();
    formData.append('usuario_id', usuario.id);
    formData.append('proyecto_id', data.proyecto_id);
    formData.append('sitio_id', data.sitio_id);
    formData.append('fecha_requerida', data.fecha_requerida);
    formData.append('lugar_entrega', data.lugar_entrega);
    formData.append('comentario', data.comentario);

    const mappedItems = data.items.map(item => ({
      material_id: item.material.id,
      cantidad: item.cantidad,
      comentario: item.comentario,
    }));
    formData.append('materiales', JSON.stringify(mappedItems));

    // Adjuntos nuevos
    archivosAdjuntos.forEach(file => {
      formData.append(isEditMode ? 'archivosNuevos' : 'archivosAdjuntos', file);
    });

    // Adjuntos existentes (solo edición)
    if (isEditMode) {
      formData.append('adjuntosExistentes', JSON.stringify(archivosExistentes.map(f => f.id)));
    }

    // Envío
    try {
      if (isEditMode) {
        await api.put(`/api/requisiciones/${requisicionId}`, formData);
        toast.success('¡Requisición actualizada con éxito!');
        onFinish?.();
      } else {
        await api.post('/api/requisiciones', formData);
        // toast.success('¡Requisición creada con éxito!');
        await clearDraft();   // limpiar borrador al crear
        onClean();
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error("Error en onSubmit:", err);
      toast.error(err?.error || 'Ocurrió un error al guardar la requisición.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-center p-8">Cargando datos del formulario...</div>;

  return (
    <>
      <fieldset disabled={isSubmitting || showSuccessModal}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 bg-gray-50" autoComplete="off">
          <DatosGenerales
            register={register} errors={errors} watch={watch} sitios={sitios}
            proyectosFiltrados={proyectosFiltrados} handleSitioChange={handleSitioChange}
            handleProyectoChange={handleProyectoChange} archivosAdjuntos={archivosAdjuntos}
            archivosExistentes={archivosExistentes} handleFileChange={handleFileChange}
            handleRemoveFile={handleRemoveFile} handleRemoveExistingFile={handleRemoveExistingFile}
            isUrgent={isUrgent} urgencyMessage={DEFAULT_URGENCY_MESSAGE}
          />
          <SeccionMateriales
            control={control} register={register} errors={errors} watch={watch}
            setValue={setValue} loading={loadingMaterials} materialesOptions={materialesOptions}
            // skuOptions={skuOptions} (Eliminado)
            // skuLoading={skuLoading} (Eliminado)
            setSearchTerm={setSearchTerm}
            // setSkuSearchTerm={setSkuSearchTerm} (Eliminado)
            handleMaterialChange={handleMaterialChange}
            unidadesLoading={unidadesLoading} duplicateMaterialIds={duplicateMaterialIds}
            proyectoId={selectedProyectoId} // Pasamos el proyecto seleccionado
          />
          <AccionesFormulario
            isSubmitting={isSubmitting} isEditMode={isEditMode}
            onFinish={onFinish} onClean={onClean}
          />
        </form>
      </fieldset>

      <Dialog
        open={showSuccessModal}
        onClose={() => { }} // No permitir cerrar con click afuera obligatoriamente, o si? Mejor obligar elección.
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"¡Requisición Creada Exitosamente!"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Tu requisición ha sido guardada. ¿A dónde deseas ir ahora?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate('/')} color="inherit">
            Ir a Dashboard
          </Button>
          <Button onClick={() => navigate('/VB_REQ')} variant="contained" color="primary" autoFocus>
            Ir a Aprobar (VB_REQ)
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default G_REQForm;
