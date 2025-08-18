import React, { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress, Button, IconButton } from '@mui/material';
import { useForm, Controller, useFieldArray } from "react-hook-form";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

function RequisicionForm() {
  // Configuración para la búsqueda de materiales en el Autocomplete
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ANOTACIÓN: Iniciamos useForm con valores por defecto para nuestra lista de items.
  // Esto asegura que el formulario comience con al menos una línea de material.
  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ material: null, cantidad: '', comentario: '' }]
    }
  });

  // ANOTACIÓN: Esta es la clave para los campos dinámicos. 'useFieldArray' nos da
  // las herramientas para agregar, quitar y mapear sobre las líneas de material.
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);

  // Carga inicial de proyectos y sitios
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

  // Lógica de filtrado de proyectos y sitios (sin cambios)
  const selectedProyectoId = watch("proyecto_id");
  const selectedSitioId = watch("sitio_id");
  let sitiosFiltrados = sitios;
  if (selectedProyectoId) {
    const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
    if (proyecto) sitiosFiltrados = sitios.filter(s => String(s.id) === String(proyecto.sitio_id));
  }
  let proyectosFiltrados = proyectos;
  if (selectedSitioId) {
    proyectosFiltrados = proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }

  // Lógica para resetear campos dependientes (sin cambios)
  useEffect(() => {
    if (selectedProyectoId && selectedSitioId) {
      const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
      if (proyecto && String(proyecto.sitio_id) !== String(selectedSitioId)) setValue("sitio_id", "");
    }
  }, [selectedProyectoId, selectedSitioId, proyectos, setValue]);
  useEffect(() => {
    if (selectedSitioId && selectedProyectoId) {
      const validProjects = proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
      if (!validProjects.some(p => String(p.id) === String(selectedProyectoId))) setValue("proyecto_id", "");
    }
  }, [selectedSitioId, selectedProyectoId, proyectos, setValue]);


  const onSubmit = (data) => {
    console.log("Datos de la requisición completa:", data);
  };

  // Función de búsqueda para el Autocomplete
  const buscarMateriales = async (input) => {
    if (!input) {
      setMaterialesOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/materiales?query=${encodeURIComponent(input)}`);
      const data = await res.json();
      setMaterialesOptions(data);
    } catch (err) {
      console.error("Error en el fetch de materiales:", err);
      setMaterialesOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // ANOTACIÓN: Función que se ejecuta al seleccionar un material.
  // Obtiene la unidad de medida y la guarda en el estado del formulario.
  const handleMaterialChange = async (selectedOption, fieldOnChange, index) => {
    fieldOnChange(selectedOption); // Actualiza el valor del material en react-hook-form
    if (selectedOption) {
      try {
        const res = await fetch(`http://localhost:3001/api/materiales/${selectedOption.id}`);
        const materialDetails = await res.json();
        setValue(`items.${index}.unidad`, materialDetails.unidad || 'N/A');
      } catch (error) {
        console.error("Error obteniendo unidad:", error);
        setValue(`items.${index}.unidad`, 'Error');
      }
    } else {
      setValue(`items.${index}.unidad`, '');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      {/* --- SECCIÓN DE DATOS GENERALES --- */}
      <div className="p-4 border rounded-lg space-y-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold border-b pb-2">Datos Generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select de Proyecto */}
          <div>
            <label htmlFor="proyecto_id" className="block font-medium">Proyecto:</label>
            <select id="proyecto_id" {...register("proyecto_id", { required: "Selecciona un proyecto" })} className="border p-2 rounded w-full">
              <option value="">Selecciona un proyecto</option>
              {proyectosFiltrados.map(proy => (<option key={proy.id} value={proy.id}>{proy.nombre}</option>))}
            </select>
            {errors.proyecto_id && <span className="text-red-500 text-sm">{errors.proyecto_id.message}</span>}
          </div>

          {/* Select de Sitio */}
          <div>
            <label htmlFor="sitio_id" className="block font-medium">Sitio:</label>
            <select id="sitio_id" {...register("sitio_id", { required: "Selecciona un sitio" })} className="border p-2 rounded w-full">
              <option value="">Selecciona un sitio</option>
              {sitiosFiltrados.map(sitio => (<option key={sitio.id} value={sitio.id}>{sitio.nombre}</option>))}
            </select>
            {errors.sitio_id && <span className="text-red-500 text-sm">{errors.sitio_id.message}</span>}
          </div>

          {/* Fecha requerida */}
          <div>
            <label htmlFor="fecha_requerida" className="block font-medium">Fecha requerida:</label>
            <input id="fecha_requerida" type="date" {...register("fecha_requerida", { required: "La fecha es obligatoria" })} className="border p-2 rounded w-full"/>
            {errors.fecha_requerida && <span className="text-red-500 text-sm">{errors.fecha_requerida.message}</span>}
          </div>

          {/* Select de Lugar de Entrega */}
          <div>
            <label htmlFor="lugar_entrega" className="block font-medium">Lugar de entrega:</label>
            <select id="lugar_entrega" {...register("lugar_entrega", { required: "Selecciona el lugar" })} className="border p-2 rounded w-full">
              <option value="">Selecciona el lugar</option>
              <option value="21">ALMACÉN IG</option>
              {selectedSitioId && (<option value={selectedSitioId}>{sitios.find(s => String(s.id) === String(selectedSitioId))?.nombre || "Sitio"}</option>)}
            </select>
            {errors.lugar_entrega && <span className="text-red-500 text-sm">{errors.lugar_entrega.message}</span>}
          </div>
        </div>
        
        {/* Comentario general */}
        <div>
          <label htmlFor="comentario" className="block font-medium">Comentario general:</label>
          <input id="comentario" placeholder="Instrucciones especiales de la requisición" {...register("comentario")} className="border p-2 rounded w-full"/>
        </div>
      </div>

      {/* --- SECCIÓN DE MATERIALES --- */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Materiales Requeridos</h2>
        {fields.map((field, index) => {
          const unidad = watch(`items.${index}.unidad`, '');
          return (
            <div key={field.id} className="flex items-start space-x-2 p-3 border rounded-lg bg-gray-50">
              <div className="flex-grow grid grid-cols-1 md:grid-cols-6 gap-3">
                
                {/* 1. Autocomplete de Material (ocupa 3 columnas) */}
                <div className="md:col-span-3">
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
                        onInputChange={(_, inputValue) => buscarMateriales(inputValue)}
                        onChange={(_, selectedOption) => handleMaterialChange(selectedOption, onChange, index)}
                        value={value}
                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                        renderInput={(params) => (
                          <TextField {...params} label={`Material #${index + 1}`} error={!!error} helperText={error?.message} />
                        )}
                      />
                    )}
                  />
                </div>

                {/* 2. Cantidad y Unidad (ocupa 1 columna) */}
                <div className="flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Cantidad"
                    {...register(`items.${index}.cantidad`, {
                      required: "Cantidad",
                      valueAsNumber: true,
                      min: { value: 0.01, message: "> 0" }
                    })}
                    className="border p-2 rounded-l-md w-full"
                  />
                  {unidad && <span className="p-2 bg-gray-200 rounded-r-md font-mono border-t border-b border-r">{unidad}</span>}
                  {errors.items?.[index]?.cantidad && <span className="text-red-500 text-sm ml-2">{errors.items[index].cantidad.message}</span>}
                </div>

                {/* 3. Comentario por Material (ocupa 2 columnas) */}
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Comentario (opcional)"
                    {...register(`items.${index}.comentario`)}
                    className="border p-2 rounded w-full"
                  />
                </div>
              </div>

              {/* Botón para eliminar */}
              <IconButton onClick={() => remove(index)} color="error" aria-label="Eliminar material" disabled={fields.length <= 1}>
                <DeleteIcon />
              </IconButton>
            </div>
          );
        })}
        
        <Button
          type="button"
          onClick={() => append({ material: null, cantidad: '', comentario: '' })}
          startIcon={<AddCircleOutlineIcon />}
        >
          Agregar Material
        </Button>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 text-lg font-bold w-full md:w-auto">
        Guardar Requisición
      </button>
    </form>
  );
}

export default RequisicionForm;