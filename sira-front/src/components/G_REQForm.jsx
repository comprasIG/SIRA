// C:\SIRA\sira-front\src\components\G_REQForm.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from "../api/api";
import { useAuth } from "../context/authContext";

import DatosGenerales from "./G_REQForm/DatosGenerales";
import SeccionMateriales from "./G_REQForm/SeccionMateriales";
import AccionesFormulario from "./G_REQForm/AccionesFormulario";
import { getFutureBusinessDate, useDebounce } from "./G_REQForm/utils";

const ALMACEN_ID = "21";
const ALMACEN_NOMBRE = "ALMACÉN IG";

function G_REQForm({ requisicionId, onFinish }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isEditMode = !!requisicionId;

  // --- Estados ---
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
  const [archivosExistentes, setArchivosExistentes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Configuración de React Hook Form ---
  const defaultFormValues = {
    items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
    proyecto_id: '', sitio_id: '', fecha_requerida: '', lugar_entrega: ALMACEN_ID, comentario: '',
  };
  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: defaultFormValues
  });

  // --- Carga de datos iniciales ---
  useEffect(() => {
    const loadInitialData = async () => {
        setIsSubmitting(true);
        try {
            const [proyectosData, sitiosData] = await Promise.all([
                api.get("/api/proyectos"),
                api.get("/api/sitios")
            ]);
            setProyectos(proyectosData);
            setSitios(sitiosData);

            if (isEditMode) {
                const reqData = await api.get(`/api/requisiciones/${requisicionId}`);
                const formattedDate = new Date(reqData.fecha_requerida).toISOString().split('T')[0];
                const lugarEntregaValue = reqData.lugar_entrega === ALMACEN_NOMBRE ? ALMACEN_ID : reqData.sitio_id;
                const mappedData = {
                    proyecto_id: reqData.proyecto_id, sitio_id: reqData.sitio_id,
                    fecha_requerida: formattedDate, lugar_entrega: lugarEntregaValue,
                    comentario: reqData.comentario_general,
                    items: reqData.materiales.map(m => ({
                        material: { id: m.material_id, nombre: m.material },
                        cantidad: m.cantidad, comentario: m.comentario, unidad: m.unidad,
                    }))
                };
                reset(mappedData);
                setArchivosExistentes(reqData.adjuntos || []);
            } else {
                setValue('fecha_requerida', getFutureBusinessDate(5));
                setValue('lugar_entrega', ALMACEN_ID);
            }
        } catch (err) {
            toast.error("Error al cargar datos iniciales.");
            if (isEditMode && onFinish) onFinish();
        } finally {
            setIsSubmitting(false);
        }
    };
    loadInitialData();
  }, [requisicionId, isEditMode, reset, setValue, onFinish]);

  // --- Lógica de Búsqueda de Materiales ---
  useEffect(() => {
    const buscarMateriales = async (query) => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/materiales?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setMaterialesOptions(data);
      } catch (err) {
        console.error("Error en el fetch de materiales:", err);
      } finally {
        setLoading(false);
      }
    };
    if (debouncedSearchTerm) {
      buscarMateriales(debouncedSearchTerm);
    } else {
      setMaterialesOptions([]);
    }
  }, [debouncedSearchTerm]);

  // --- Handlers y Lógica de Formulario ---
  const handleSitioChange = (e) => {
    setValue("sitio_id", e.target.value, { shouldValidate: true });
    const newSitioId = e.target.value;
    const proyectosValidos = proyectos.filter(p => String(p.sitio_id) === String(newSitioId));
    if (!proyectosValidos.some(p => String(p.id) === String(watch("proyecto_id")))) {
      setValue("proyecto_id", "", { shouldValidate: true });
    }
    if (String(newSitioId) === ALMACEN_ID) {
      setValue("lugar_entrega", ALMACEN_ID, { shouldValidate: true });
    }
  };

  const handleProyectoChange = (e) => {
    setValue("proyecto_id", e.target.value, { shouldValidate: true });
    const newProyectoId = e.target.value;
    const proyecto = proyectos.find((p) => String(p.id) === String(newProyectoId));
    if (proyecto) {
      setValue("sitio_id", proyecto.sitio_id, { shouldValidate: true });
      if (String(proyecto.sitio_id) === ALMACEN_ID) {
        setValue("lugar_entrega", ALMACEN_ID, { shouldValidate: true });
      }
    }
  };

  const handleMaterialChange = async (selectedOption, fieldOnChange, index) => {
    fieldOnChange(selectedOption);
    if (selectedOption) {
      setUnidadesLoading(prev => ({ ...prev, [index]: true }));
      try {
        const res = await fetch(`http://localhost:3001/api/materiales/${selectedOption.id}`);
        const materialDetails = await res.json();
        setValue(`items.${index}.unidad`, materialDetails.unidad || 'N/A');
      } catch (error) {
        setValue(`items.${index}.unidad`, 'Error');
      } finally {
        setUnidadesLoading(prev => ({ ...prev, [index]: false }));
      }
    } else {
      setValue(`items.${index}.unidad`, '');
    }
  };
  
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if ((archivosAdjuntos.length + archivosExistentes.length + files.length) > 5) {
      toast.warn("Puedes tener un máximo de 5 archivos en total.");
      return;
    }
    setArchivosAdjuntos(prev => [...prev, ...files]);
  };
  
  const handleRemoveFile = (fileNameToRemove) => {
    setArchivosAdjuntos(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const handleRemoveExistingFile = (fileIdToRemove) => {
    setArchivosExistentes(prev => prev.filter(file => file.id !== fileIdToRemove));
  };
  
  const selectedSitioId = watch("sitio_id");
  const proyectosFiltrados = useMemo(() => {
    if (!selectedSitioId) return proyectos;
    return proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }, [selectedSitioId, proyectos]);

  const onClean = () => {
    reset(defaultFormValues);
    setValue('fecha_requerida', getFutureBusinessDate(5));
    setValue('lugar_entrega', ALMACEN_ID);
    setArchivosAdjuntos([]);
    setArchivosExistentes([]);
  };

  // --- Lógica de Envío del Formulario ---
  const onSubmit = async (form) => {
    setIsSubmitting(true);
    let lugarEntregaTexto = "";
    if (form.lugar_entrega === ALMACEN_ID) {
      lugarEntregaTexto = ALMACEN_NOMBRE;
    } else if (form.sitio_id) {
      const sitio = sitios.find(s => String(s.id) === String(form.sitio_id));
      lugarEntregaTexto = sitio?.nombre || "Sitio";
    }
    const materiales = form.items
      .filter(it => it?.material && Number(it?.cantidad) > 0)
      .map(it => ({
        material_id: it.material.id,
        cantidad: Number(it.cantidad),
        comentario: it.comentario?.trim() || undefined,
      }));
    
    if (materiales.length === 0) {
      toast.error("Debes agregar al menos un material con cantidad válida.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
        proyecto_id: form.proyecto_id,
        sitio_id: form.sitio_id,
        fecha_requerida: form.fecha_requerida,
        lugar_entrega: lugarEntregaTexto,
        comentario: form.comentario,
        materiales,
        usuario_id: usuario.id,
    };
    
    try {
        if (isEditMode) {
            const formData = new FormData();
            
            Object.keys(payload).forEach(key => {
                const value = key === 'materiales' ? JSON.stringify(payload[key]) : payload[key];
                formData.append(key, value);
            });

            archivosAdjuntos.forEach(file => formData.append('archivosNuevos', file));

            const idAdjuntosExistentes = archivosExistentes.map(f => f.id);
            formData.append('adjuntosExistentes', JSON.stringify(idAdjuntosExistentes));

            await api.put(`/api/requisiciones/${requisicionId}`, formData);
            toast.success(`Requisición actualizada con éxito.`);
            if (onFinish) onFinish();
        } else {
            const formData = new FormData();
            Object.keys(payload).forEach(key => {
                const value = key === 'materiales' ? JSON.stringify(payload[key]) : payload[key];
                formData.append(key, value);
            });
            archivosAdjuntos.forEach(file => formData.append('archivosAdjuntos', file));
            
            const data = await api.post("/api/requisiciones", formData);
            toast.success(`Requisición ${data.numero_requisicion} creada con éxito.`);
            navigate('/dashboard');
        }
    } catch (err) {
      console.error(err);
      toast.error(err.error || "Ocurrió un error al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <fieldset disabled={isSubmitting}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 bg-gray-50" autoComplete="off">
            <DatosGenerales 
                register={register}
                errors={errors}
                watch={watch}
                sitios={sitios}
                proyectosFiltrados={proyectosFiltrados}
                handleSitioChange={handleSitioChange}
                handleProyectoChange={handleProyectoChange}
                archivosAdjuntos={archivosAdjuntos}
                archivosExistentes={archivosExistentes}
                handleFileChange={handleFileChange}
                handleRemoveFile={handleRemoveFile}
                handleRemoveExistingFile={handleRemoveExistingFile}
                isEditMode={isEditMode}
            />
            <SeccionMateriales
                control={control}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                loading={loading}
                materialesOptions={materialesOptions}
                setSearchTerm={setSearchTerm}
                handleMaterialChange={handleMaterialChange}
                unidadesLoading={unidadesLoading}
            />
            <AccionesFormulario
                isSubmitting={isSubmitting}
                isEditMode={isEditMode}
                onFinish={onFinish}
                onClean={onClean}
            />
        </form>
    </fieldset>
  );
}

export default G_REQForm;