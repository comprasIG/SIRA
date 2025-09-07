// C:\SIRA\sira-front\src\components\G_REQForm.jsx
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from "../api/api";
import { useAuth } from "../context/authContext";

// Importación de componentes de UI
import DatosGenerales from "./G_REQForm/DatosGenerales";
import SeccionMateriales from "./G_REQForm/SeccionMateriales";
import AccionesFormulario from "./G_REQForm/AccionesFormulario";

// Importación de nuestros Custom Hooks
import { useFormAttachments } from "./G_REQForm/hooks/useFormAttachments";
import { useInitialData } from "./G_REQForm/hooks/useInitialData";
import { useMaterialLogic } from "./G_REQForm/hooks/useMaterialLogic";
import { useFormValidation } from "./G_REQForm/hooks/useFormValidation";

// Constantes del formulario
const ALMACEN_ID = "21";

function G_REQForm({ requisicionId, onFinish }) {
  // --- Hooks Nativos y de Contexto ---
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isEditMode = !!requisicionId;

  // --- Estado Local del Componente ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Configuración de React Hook Form ---
  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: {
      items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
      proyecto_id: '', sitio_id: '', fecha_requerida: '', lugar_entrega: ALMACEN_ID, comentario: '',
    }
  });

  // --- Uso de Custom Hooks para manejar la lógica ---
  const {
    archivosAdjuntos, setArchivosAdjuntos,
    archivosExistentes, setArchivosExistentes,
    handleFileChange, handleRemoveFile, handleRemoveExistingFile
  } = useFormAttachments();

  const { proyectos, sitios, isLoading } = useInitialData(requisicionId, reset, setValue, setArchivosExistentes);
  
  const {
    materialesOptions, loading: loadingMaterials, unidadesLoading,
    setSearchTerm, handleMaterialChange
  } = useMaterialLogic(setValue);

  const { duplicateMaterialIds } = useFormValidation(control);

  // --- Lógica de renderizado y Handlers específicos del componente ---
  const selectedSitioId = watch("sitio_id");
  const proyectosFiltrados = useMemo(() => {
    if (!selectedSitioId) return proyectos;
    return proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }, [selectedSitioId, proyectos]);

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

  // --- Lógica de Envío del Formulario ---
  const onSubmit = async (data) => {
    // 1. Validaciones previas al envío
    if (duplicateMaterialIds.size > 0) {
      toast.error("No puedes enviar la requisición porque contiene materiales duplicados.");
      return;
    }
    if (!data.items || data.items.some(item => !item.material || !item.cantidad)) {
      toast.error("Todos los materiales deben tener un producto y una cantidad seleccionados.");
      return;
    }

    setIsSubmitting(true);
    
    // 2. Construcción del payload con FormData
    const formData = new FormData();
    formData.append('usuario_id', usuario.id);
    formData.append('proyecto_id', data.proyecto_id);
    formData.append('sitio_id', data.sitio_id);
    formData.append('fecha_requerida', data.fecha_requerida);
    formData.append('lugar_entrega', data.lugar_entrega);
    formData.append('comentario', data.comentario);

    // Mapear y stringificar el array de materiales
    const mappedItems = data.items.map(item => ({
        material_id: item.material.id,
        cantidad: item.cantidad,
        comentario: item.comentario,
    }));
    formData.append('materiales', JSON.stringify(mappedItems));

    // Adjuntar los archivos nuevos
    archivosAdjuntos.forEach(file => {
      // El backend espera 'archivosAdjuntos' para crear y 'archivosNuevos' para actualizar
      formData.append(isEditMode ? 'archivosNuevos' : 'archivosAdjuntos', file);
    });
    
    // Si estamos en modo edición, enviar la lista de IDs de archivos existentes
    if (isEditMode) {
      formData.append('adjuntosExistentes', JSON.stringify(archivosExistentes.map(f => f.id)));
    }

    // 3. Envío a la API
    try {
      if (isEditMode) {
        await api.put(`/api/requisiciones/${requisicionId}`, formData);
        toast.success('¡Requisición actualizada con éxito!');
      } else {
        await api.post('/api/requisiciones', formData);
        toast.success('¡Requisición creada con éxito!');
        onClean(); // Limpiar formulario después de crear
      }

      if (onFinish) onFinish(); // Ejecutar callback (ej. cerrar modal) si se proporciona
      
    } catch (err) {
      toast.error(err.error || 'Ocurrió un error al guardar la requisición.');
      console.error("Error en onSubmit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Cargando datos del formulario...</div>;
  }

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