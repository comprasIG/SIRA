import React, { useEffect, useState, useMemo } from "react";
import { Autocomplete, TextField, Button, IconButton, CircularProgress } from '@mui/material';
import { useForm, Controller, useFieldArray } from "react-hook-form";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import api from "../api/api";

// --- Hook de Debounce para optimizar la búsqueda ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// --- Constante para evitar "números mágicos" ---
const ALMACEN_ID = "21";

function G_REQForm() {
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const defaultFormValues = {
    items: [{ material: null, cantidad: '', comentario: '', unidad: '' }],
    proyecto_id: '',
    sitio_id: '',
    fecha_requerida: '',
    lugar_entrega: '',
    comentario: '',
  };

  const { register, handleSubmit, setValue, watch, control, formState: { errors }, reset } = useForm({
    defaultValues: defaultFormValues
  });

  const { fields, prepend, remove } = useFieldArray({
    control,
    name: "items"
  });

  // Cargar proyectos y sitios al inicio
  useEffect(() => {
    fetch("http://localhost:3001/api/proyectos")
      .then(res => res.json())
      .then(data => setProyectos(data))
      .catch(err => console.error("Error cargando proyectos:", err));

    fetch("http://localhost:3001/api/sitios")
      .then(res => res.json())
      .then(data => setSitios(data))
      .catch(err => console.error("Error cargando sitios:", err));
  }, []);
  
  const selectedProyectoId = watch("proyecto_id");
  const selectedSitioId = watch("sitio_id");

  const sitiosFiltrados = useMemo(() => {
    if (!selectedProyectoId) return sitios;
    const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
    return proyecto ? sitios.filter(s => String(s.id) === String(proyecto.sitio_id)) : [];
  }, [selectedProyectoId, proyectos, sitios]);

  const proyectosFiltrados = useMemo(() => {
    if (!selectedSitioId) return proyectos;
    return proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }, [selectedSitioId, proyectos]);

  // Reseteo de dependencias
  useEffect(() => {
    if (selectedProyectoId && selectedSitioId) {
      const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
      if (proyecto && String(proyecto.sitio_id) !== String(selectedSitioId)) {
        setValue("sitio_id", "");
      }
    }
  }, [selectedProyectoId, selectedSitioId, proyectos, setValue]);

  useEffect(() => {
    if (selectedSitioId && selectedProyectoId) {
      const validProjects = proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
      if (!validProjects.some(p => String(p.id) === String(selectedProyectoId))) {
        setValue("proyecto_id", "");
      }
    }
  }, [selectedSitioId, selectedProyectoId, proyectos, setValue]);

  useEffect(() => {
    const buscarMateriales = async (query) => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/materiales?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setMaterialesOptions(data);
      } catch (err) {
        console.error("Error en el fetch de materiales:", err);
        setMaterialesOptions([]);
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


  const onSubmit = async (form) => {
    let lugarEntregaTexto = "";
    if (form.lugar_entrega === ALMACEN_ID) {
      lugarEntregaTexto = "ALMACÉN IG";
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
      alert("Debes agregar al menos un material con cantidad válida.");
      return;
    }

    const payload = {
      proyecto_id: Number(form.proyecto_id),
      sitio_id: Number(form.sitio_id),
      fecha_requerida: form.fecha_requerida,
      lugar_entrega: lugarEntregaTexto,
      comentario: form.comentario?.trim() || undefined,
      materiales,
    };
    
    console.log("Payload enviado al backend:", payload);
    try {
      /*
      const res = await fetch("http://localhost:3001/api/requisiciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw data;
*/      const data = await api.post("/api/requisiciones", payload);
      alert(`Requisición creada: ${data.numero_requisicion} (ID ${data.requisicion_id})`);
      reset(defaultFormValues);
      setMaterialesOptions([]);
    } catch (err) {
      console.error(err);
      const errorMsg = err.error || "Error al crear la requisición";
      const missing = err.materiales_faltantes ? ` Materiales faltantes: ${err.materiales_faltantes.join(", ")}` : '';
      alert(`${errorMsg}.${missing}`);
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
  
  const inputStyle = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 bg-gray-50" autoComplete="off">
      
      {/* --- SECCIÓN DE DATOS GENERALES --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">Datos Generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          
          <div>
            <label htmlFor="proyecto_id" className="block text-sm font-medium text-gray-700">Proyecto</label>
            <select id="proyecto_id" {...register("proyecto_id", { required: "Selecciona un proyecto" })} className={inputStyle}>
              <option value="">Selecciona un proyecto...</option>
              {proyectosFiltrados.map(proy => (<option key={proy.id} value={proy.id}>{proy.nombre}</option>))}
            </select>
            {errors.proyecto_id && <span className="text-red-600 text-xs mt-1">{errors.proyecto_id.message}</span>}
          </div>

          <div>
            <label htmlFor="sitio_id" className="block text-sm font-medium text-gray-700">Sitio</label>
            <select id="sitio_id" {...register("sitio_id", { required: "Selecciona un sitio" })} className={inputStyle}>
              <option value="">Selecciona un sitio...</option>
              {sitiosFiltrados.map(sitio => (<option key={sitio.id} value={sitio.id}>{sitio.nombre}</option>))}
            </select>
            {errors.sitio_id && <span className="text-red-600 text-xs mt-1">{errors.sitio_id.message}</span>}
          </div>

          <div>
            <label htmlFor="fecha_requerida" className="block text-sm font-medium text-gray-700">Fecha Requerida</label>
            <input id="fecha_requerida" type="date" {...register("fecha_requerida", { required: "La fecha es obligatoria" })} className={inputStyle} />
            {errors.fecha_requerida && <span className="text-red-600 text-xs mt-1">{errors.fecha_requerida.message}</span>}
          </div>

          <div>
            <label htmlFor="lugar_entrega" className="block text-sm font-medium text-gray-700">Lugar de Entrega</label>
            <select id="lugar_entrega" {...register("lugar_entrega", { required: "Selecciona el lugar" })} className={inputStyle}>
              <option value="">Selecciona el lugar...</option>
              <option value={ALMACEN_ID}>ALMACÉN IG</option>
              {selectedSitioId && (<option value={selectedSitioId}>{sitios.find(s => String(s.id) === String(selectedSitioId))?.nombre || "Sitio"}</option>)}
            </select>
            {errors.lugar_entrega && <span className="text-red-600 text-xs mt-1">{errors.lugar_entrega.message}</span>}
          </div>

          <div className="md:col-span-2">
             <label htmlFor="comentario" className="block text-sm font-medium text-gray-700">Comentario General (Opcional)</label>
            <input id="comentario" placeholder="Instrucciones especiales de la requisición..." {...register("comentario")} className={inputStyle} autoComplete="off" />
          </div>
        </div>
      </div>
      
      {/* --- SECCIÓN DE MATERIALES --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Materiales Requeridos</h2>
            {/* --- MEJORA UX: Botón movido a la parte superior de la sección --- */}
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
        
        {/* El contenedor de la lista ahora tiene un espacio superior */}
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
                    type="number" step="any" placeholder="Cant." min="0"
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
                    {errors.items?.[index]?.cantidad && <span className="text-red-600 text-xs col-span-full md:col-span-1">{errors.items[index].cantidad.message}</span>}
                
                <div className="md:col-span-3">
                    <input type="text" placeholder="Comentario (opcional)"
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
      
      {/* --- SECCIÓN DE ACCIONES --- */}
      <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-4 border-t-2 border-gray-200">
        <button
            type="button"
            onClick={() => reset(defaultFormValues)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 transform hover:scale-105"
          >
          <CleaningServicesIcon />
          Limpiar Formulario
        </button>
        <button
          type="submit"
          className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
        >
          Guardar Requisición
        </button>
      </div>
    </form>
  );
}

export default G_REQForm;
