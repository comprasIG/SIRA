// C:\SIRA\sira-front\src\components\G_REQForm.jsx
// C:\SIRA\sira-front\src\components\G_REQForm.jsx

import React, { useEffect, useState, useMemo } from "react";
import { Autocomplete, TextField, Button, IconButton, CircularProgress, Chip } from '@mui/material';
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import api from "../api/api";
import { useAuth } from "../context/authContext";

// ----------- Estilos para los inputs -----------
const inputStyle =
  "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";

// ----------- Utilidad: Fecha hábil (sin fines de semana) -----------
function getFutureBusinessDate(dias) {
  let count = 0;
  let futureDate = new Date();
  while (count < dias) {
    futureDate.setDate(futureDate.getDate() + 1);
    const dayOfWeek = futureDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ----------- Hook debounce para búsqueda de materiales -----------
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const ALMACEN_ID = "21";
const ALMACEN_NOMBRE = "ALMACÉN IG";

// ----------- COMPONENTE PRINCIPAL -----------
// --- CORRECCIÓN: El componente ahora acepta props para el modo edición ---
function G_REQForm({ requisicionId, onFinish }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isEditMode = !!requisicionId; // Determina si estamos en modo edición

  // ----------- Estados principales -----------
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----------- Valores iniciales del formulario -----------
  const defaultFormValues = {
    items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
    proyecto_id: '',
    sitio_id: '',
    fecha_requerida: getFutureBusinessDate(5),
    lugar_entrega: ALMACEN_ID,
    comentario: '',
  };
  
  // ----------- React Hook Form setup -----------
  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: defaultFormValues
  });
  const { fields, prepend, remove } = useFieldArray({ control, name: "items" });

  // --- CORRECCIÓN: useEffect ahora maneja la carga de datos para ambos modos ---
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
                // Mapeamos los datos para que coincidan con la estructura del formulario de Autocomplete
                const mappedData = {
                    ...reqData,
                    items: reqData.materiales.map(m => ({
                        material: { id: m.material_id, nombre: m.material }, // Objeto para el Autocomplete
                        cantidad: m.cantidad,
                        comentario: m.comentario,
                        unidad: m.unidad,
                    }))
                };
                reset(mappedData);
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

  // ----------- Watchers y handlers de selects dependientes -----------
  const sitioRegister = register("sitio_id", { required: "Selecciona un sitio" });
  const proyectoRegister = register("proyecto_id", { required: "Selecciona un proyecto" });
  const selectedSitioId = watch("sitio_id");
  const lugarEntregaSeleccionado = watch("lugar_entrega");
  
  const proyectosFiltrados = useMemo(() => {
    if (!selectedSitioId) return proyectos;
    return proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }, [selectedSitioId, proyectos]);
  
  const handleSitioChange = (e) => {
    sitioRegister.onChange(e);
    const newSitioId = e.target.value;
    const proyectosValidos = proyectos.filter(p => String(p.sitio_id) === String(newSitioId));
    if (!proyectosValidos.some((p) => String(p.id) === String(watch("proyecto_id")))) {
      setValue("proyecto_id", "", { shouldValidate: true });
    }
    if (String(newSitioId) === ALMACEN_ID) {
      setValue("lugar_entrega", ALMACEN_ID, { shouldValidate: true });
    }
  };

  const handleProyectoChange = (e) => {
    proyectoRegister.onChange(e);
    const newProyectoId = e.target.value;
    const proyecto = proyectos.find((p) => String(p.id) === String(newProyectoId));
    if (proyecto) {
      setValue("sitio_id", proyecto.sitio_id, { shouldValidate: true });
      if (String(proyecto.sitio_id) === ALMACEN_ID) {
        setValue("lugar_entrega", ALMACEN_ID, { shouldValidate: true });
      }
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if ((archivosAdjuntos.length + files.length) > 5) {
      toast.warn("Puedes seleccionar un máximo de 5 archivos en total.");
      return;
    }
    setArchivosAdjuntos(prev => [...prev, ...files]);
  };
  const handleRemoveFile = (fileNameToRemove) => {
    setArchivosAdjuntos(prev => prev.filter(file => file.name !== fileNameToRemove));
  };
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

  // --- CORRECCIÓN: onSubmit ahora maneja ambos casos: crear y actualizar ---
  const onSubmit = async (form) => {
    setIsSubmitting(true);
    // Validaciones
    if (!form.proyecto_id || !form.sitio_id || !form.fecha_requerida) {
      toast.error("Debes seleccionar sitio, proyecto y fecha requerida.");
      setIsSubmitting(false);
      return;
    }
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
    if (!usuario) {
      toast.error("No se pudo obtener el usuario autenticado.");
      setIsSubmitting(false);
      return;
    }

    // Prepara el payload de datos (sin los archivos, que se manejan aparte si es necesario)
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
            await api.put(`/api/requisiciones/${requisicionId}`, payload);
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

  const handleMaterialChange = async (selectedOption, fieldOnChange, index) => {
    fieldOnChange(selectedOption);
    if (selectedOption) {
      setUnidadesLoading(prev => ({ ...prev, [index]: true }));
      try {
        const res = await fetch(`http://localhost:3001/api/materiales/${selectedOption.id}`);
        const materialDetails = await res.json();
        setValue(`items.${index}.unidad`, materialDetails.unidad || 'N/A');
      } catch (error) {
        console.error("Error obteniendo unidad:", error);
        setValue(`items.${index}.unidad`, 'Error');
      } finally {
        setUnidadesLoading(prev => ({ ...prev, [index]: false }));
      }
    } else {
      setValue(`items.${index}.unidad`, '');
    }
  };
  const renderLugarEntregaOptions = () => {
    if (String(selectedSitioId) === ALMACEN_ID) {
      return (
        <option value={ALMACEN_ID}>{ALMACEN_NOMBRE}</option>
      );
    }
    return (
      <>
        <option value={ALMACEN_ID}>{ALMACEN_NOMBRE}</option>
        {selectedSitioId && (
          <option value={selectedSitioId}>
            {sitios.find(s => String(s.id) === String(selectedSitioId))?.nombre || "Sitio"}
          </option>
        )}
      </>
    );
  };

  return (
    <fieldset disabled={isSubmitting}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 bg-gray-50" autoComplete="off">
            <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">Datos Generales</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label htmlFor="sitio_id" className="block text-sm font-medium text-gray-700">Sitio</label>
                        <select id="sitio_id" {...sitioRegister} className={inputStyle} onChange={handleSitioChange}>
                            <option value="">Selecciona un sitio...</option>
                            {sitios.map(sitio => (<option key={sitio.id} value={sitio.id}>{sitio.nombre}</option>))}
                        </select>
                        {errors.sitio_id && <span className="text-red-600 text-xs mt-1">{errors.sitio_id.message}</span>}
                    </div>
                    <div>
                        <label htmlFor="proyecto_id" className="block text-sm font-medium text-gray-700">Proyecto</label>
                        <select id="proyecto_id" {...proyectoRegister} className={inputStyle} onChange={handleProyectoChange}>
                            <option value="">Selecciona un proyecto...</option>
                            {proyectosFiltrados.map(proy => (<option key={proy.id} value={proy.id}>{proy.nombre}</option>))}
                        </select>
                        {errors.proyecto_id && <span className="text-red-600 text-xs mt-1">{errors.proyecto_id.message}</span>}
                    </div>
                    <div>
                        <label htmlFor="fecha_requerida" className="block text-sm font-medium text-gray-700">Fecha Requerida</label>
                        <input id="fecha_requerida" type="date" {...register("fecha_requerida", { required: "La fecha es obligatoria" })} className={inputStyle} />
                        {errors.fecha_requerida && <span className="text-red-600 text-xs mt-1">{errors.fecha_requerida.message}</span>}
                    </div>
                    <div>
                        <label htmlFor="lugar_entrega" className="block text-sm font-medium text-gray-700">Lugar de Entrega</label>
                        <select
                        id="lugar_entrega"
                        {...register("lugar_entrega", { required: "Selecciona el lugar" })}
                        className={inputStyle}
                        value={lugarEntregaSeleccionado || ALMACEN_ID}
                        onChange={e => setValue("lugar_entrega", e.target.value, { shouldValidate: true })}
                        >
                        <option value="">Selecciona el lugar...</option>
                        {renderLugarEntregaOptions()}
                        </select>
                        {errors.lugar_entrega && <span className="text-red-600 text-xs mt-1">{errors.lugar_entrega.message}</span>}
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="comentario" className="block text-sm font-medium text-gray-700">Comentario General (Opcional)</label>
                        <input id="comentario" placeholder="Instrucciones especiales de la requisición..." {...register("comentario")} className={inputStyle} autoComplete="off" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="archivo" className="block text-sm font-medium text-gray-700">Adjuntar Archivos (máx. 5)</label>
                        <div className="mt-1 flex flex-col items-start gap-4">
                        <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} disabled={archivosAdjuntos.length >= 5}>
                            Seleccionar Archivos
                            <input type="file" multiple hidden onChange={handleFileChange} />
                        </Button>
                        {archivosAdjuntos.length > 0 && (
                            <div className="w-full p-3 border border-gray-200 rounded-md bg-gray-50">
                            <p className="text-sm font-semibold mb-2">Archivos seleccionados:</p>
                            <div className="flex flex-wrap gap-2">
                                {archivosAdjuntos.map((file, index) => (
                                <Chip
                                    key={index}
                                    label={file.name}
                                    onDelete={() => handleRemoveFile(file.name)}
                                    color="primary"
                                    variant="outlined"
                                />
                                ))}
                            </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
                <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Materiales Requeridos</h2>
                <Button
                    type="button"
                    onClick={() => prepend({ material: null, cantidad: '', comentario: '', unidad: '' })}
                    startIcon={<AddCircleOutlineIcon />}
                    className="transition-transform duration-300 hover:scale-105"
                    variant="contained"
                >
                    Agregar
                </Button>
                </div>
                <div className="space-y-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50/50 transition-all duration-300">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        <div className="md:col-span-6">
                        <Controller
                            name={`items.${index}.material`}
                            control={control}
                            rules={{ required: "Debes seleccionar un material" }}
                            render={({ field: { onChange, value }, fieldState: { error } }) => (
                                <Autocomplete
                                options={materialesOptions}
                                getOptionLabel={(option) => option.nombre || ''}
                                filterOptions={(x) => x}
                                loading={loading}
                                onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
                                onChange={(_, selectedOption) => handleMaterialChange(selectedOption, onChange, index)}
                                value={value}
                                isOptionEqualToValue={(option, val) => option && val && option.id === val.id}
                                renderInput={(params) => (
                                    <TextField
                                    {...params}
                                    label={`Material #${index + 1}`}
                                    error={!!error}
                                    helperText={error?.message}
                                    variant="outlined"
                                    size="small"
                                    inputProps={{
                                        ...params.inputProps,
                                        autoComplete: 'off',
                                    }}
                                    />
                                )}
                                />
                            )}
                        />
                        </div>
                        <div className="md:col-span-2 flex items-center">
                        <input
                            type="number"
                            step="any"
                            placeholder="Cant."
                            min="0"
                            {...register(`items.${index}.cantidad`, {
                            required: "Req.", valueAsNumber: true, min: { value: 1, message: "> 0" }
                            })}
                            className="w-full border-gray-300 rounded-l-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                            autoComplete="off"
                        />
                        <span className="inline-flex items-center px-3 h-[40px] rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-600 text-sm font-mono">
                            {unidadesLoading[index] ? <CircularProgress size={16} /> : watch(`items.${index}.unidad`) || '...'}
                        </span>
                        </div>
                        {errors.items?.[index]?.cantidad && (
                        <span className="text-red-600 text-xs col-span-full md:col-span-1">{errors.items[index].cantidad.message}</span>
                        )}
                        <div className="md:col-span-3">
                        <input
                            type="text"
                            placeholder="Comentario (opcional)"
                            {...register(`items.${index}.comentario`)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                            autoComplete="off"
                        />
                        </div>
                    </div>
                    <IconButton onClick={() => remove(index)} color="error" disabled={fields.length <= 1} className="transition-transform duration-300 hover:scale-125">
                        <DeleteIcon />
                    </IconButton>
                    </div>
                ))}
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-4 border-t-2 border-gray-200">
                {/* --- CORRECCIÓN: Botones dinámicos según el modo --- */}
                {isEditMode ? (
                    <Button
                        type="button"
                        onClick={onFinish}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700"
                    >
                        Cancelar
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={() => {
                            reset(defaultFormValues);
                            setValue('fecha_requerida', getFutureBusinessDate(5));
                            setValue('lugar_entrega', ALMACEN_ID);
                            setArchivosAdjuntos([]);
                        }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700"
                    >
                        <CleaningServicesIcon />
                        Limpiar Formulario
                    </Button>
                )}
                <Button
                    type="submit"
                    className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <div className="flex items-center gap-2">
                            <CircularProgress size={24} color="inherit" />
                            <span>{isEditMode ? 'Actualizando...' : 'Enviando...'}</span>
                        </div>
                    ) : (
                        isEditMode ? 'Actualizar Requisición' : 'Guardar Requisición'
                    )}
                </Button>
            </div>
        </form>
    </fieldset>
  );
}

export default G_REQForm;