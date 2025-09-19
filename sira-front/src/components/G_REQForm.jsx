// C:\SIRA\sira-front\src\components\G_REQForm.jsx
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
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

function G_REQForm({ requisicionId, onFinish }) {
  // --- Contexto / Navegación ---
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isEditMode = !!requisicionId;

  // --- Estado local ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- React Hook Form ---
  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: {
      items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
      proyecto_id: '', sitio_id: '', fecha_requerida: '', lugar_entrega: ALMACEN_ID, comentario: '',
    }
  });

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
    materialesOptions, loading: loadingMaterials, unidadesLoading,
    setSearchTerm, handleMaterialChange
  } = useMaterialLogic(setValue);

  // --- Validación (duplicados) ---
  const { duplicateMaterialIds } = useFormValidation(control);

  // --- Render helpers ---
  const selectedSitioId = watch("sitio_id");
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
    reset({
      items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
      proyecto_id: '', sitio_id: '', fecha_requerida: '', lugar_entrega: ALMACEN_ID, comentario: '',
    });
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
      } else {
        await api.post('/api/requisiciones', formData);
        toast.success('¡Requisición creada con éxito!');
        await clearDraft();   // limpiar borrador al crear
        onClean();
      }
      onFinish?.();
    } catch (err) {
      console.error("Error en onSubmit:", err);
      toast.error(err?.error || 'Ocurrió un error al guardar la requisición.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-center p-8">Cargando datos del formulario...</div>;

  return (
    <fieldset disabled={isSubmitting}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 bg-gray-50" autoComplete="off">
        <DatosGenerales
          register={register} errors={errors} watch={watch} sitios={sitios}
          proyectosFiltrados={proyectosFiltrados} handleSitioChange={handleSitioChange}
          handleProyectoChange={handleProyectoChange} archivosAdjuntos={archivosAdjuntos}
          archivosExistentes={archivosExistentes} handleFileChange={handleFileChange}
          handleRemoveFile={handleRemoveFile} handleRemoveExistingFile={handleRemoveExistingFile}
          isEditMode={isEditMode}
        />
        <SeccionMateriales
          control={control} register={register} errors={errors} watch={watch}
          setValue={setValue} loading={loadingMaterials} materialesOptions={materialesOptions}
          setSearchTerm={setSearchTerm} handleMaterialChange={handleMaterialChange}
          unidadesLoading={unidadesLoading} duplicateMaterialIds={duplicateMaterialIds}
        />
        <AccionesFormulario
          isSubmitting={isSubmitting} isEditMode={isEditMode}
          onFinish={onFinish} onClean={onClean}
        />
      </form>
    </fieldset>
  );
}

export default G_REQForm;
