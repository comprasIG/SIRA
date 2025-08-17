import React, { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useForm, Controller } from "react-hook-form";

function RequisicionForm() {
  //{configuración de carga de materiales
  const [materialesOptions, setMaterialesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  //fin carga de materiales

  // Configuración de proyectos y sitios
  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm();
  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);

  // Cargar proyectos y sitios al montar
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

  // Valores seleccionados
  const selectedProyectoId = watch("proyecto_id");
  const selectedSitioId = watch("sitio_id");

  // Filtrar sitios según proyecto seleccionado
  let sitiosFiltrados = sitios;
  if (selectedProyectoId) {
    const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
    if (proyecto) {
      sitiosFiltrados = sitios.filter(s => String(s.id) === String(proyecto.sitio_id));
    }
  }

  // Filtrar proyectos según sitio seleccionado
  let proyectosFiltrados = proyectos;
  if (selectedSitioId) {
    proyectosFiltrados = proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
  }

  // Si al cambiar una selección, la otra ya no es válida, la reseteas
  useEffect(() => {
    // Si el sitio seleccionado no corresponde al proyecto, resetea sitio
    if (selectedProyectoId && selectedSitioId) {
      const proyecto = proyectos.find(p => String(p.id) === String(selectedProyectoId));
      if (proyecto && String(proyecto.sitio_id) !== String(selectedSitioId)) {
        setValue("sitio_id", "");
      }
    }
  }, [selectedProyectoId, selectedSitioId, proyectos, setValue]);

  useEffect(() => {
    // Si el proyecto seleccionado no corresponde al sitio, resetea proyecto
    if (selectedSitioId && selectedProyectoId) {
      const validProjects = proyectos.filter(p => String(p.sitio_id) === String(selectedSitioId));
      if (!validProjects.some(p => String(p.id) === String(selectedProyectoId))) {
        setValue("proyecto_id", "");
      }
    }
  }, [selectedSitioId, selectedProyectoId, proyectos, setValue]);

  const onSubmit = (data) => {
    console.log("Datos enviados:", data);
    // Aquí irá la lógica para mandar al backend
  };

  // Busca materiales en backend según el input
  const buscarMateriales = async (input) => {
    if (!input) return [];
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/materiales?query=${encodeURIComponent(input)}`);
      const data = await res.json();
      setMaterialesOptions(data);
    } catch (err) {
      setMaterialesOptions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Select de Proyecto */}
      <div>
        <label htmlFor="proyecto_id" className="block font-medium">Proyecto:</label>
        <select
          id="proyecto_id"
          {...register("proyecto_id", { required: "Selecciona un proyecto" })}
          className="border p-2 rounded w-full"
        >
          <option value="">Selecciona un proyecto</option>
          {proyectosFiltrados.map(proy => (
            <option key={proy.id} value={proy.id}>
              {proy.nombre}
            </option>
          ))}
        </select>
        {errors.proyecto_id && (
          <span className="text-red-500">{errors.proyecto_id.message}</span>
        )}
      </div>

      {/* Select de Sitio */}
      <div>
        <label htmlFor="sitio_id" className="block font-medium">Sitio:</label>
        <select
          id="sitio_id"
          {...register("sitio_id", { required: "Selecciona un sitio" })}
          className="border p-2 rounded w-full"
        >
          <option value="">Selecciona un sitio</option>
          {sitiosFiltrados.map(sitio => (
            <option key={sitio.id} value={sitio.id}>
              {sitio.nombre}
            </option>
          ))}
        </select>
        {errors.sitio_id && (
          <span className="text-red-500">{errors.sitio_id.message}</span>
        )}
      </div>

      {/* Fecha requerida */}        
        <div>
      <label htmlFor="fecha_requerida" className="block font-medium">Fecha requerida:</label>
      <input
        id="fecha_requerida"
        type="date"
        {...register("fecha_requerida", { required: "La fecha requerida es obligatoria" })}
        className="border p-2 rounded w-full"
      />
      {errors.fecha_requerida && (
        <span className="text-red-500">{errors.fecha_requerida.message}</span>
      )}
    </div>

      {/* Select de Lugar de Entrega */}        
      <div>
      <label htmlFor="lugar_entrega" className="block font-medium">Lugar de entrega:</label>
      <select
        id="lugar_entrega"
        {...register("lugar_entrega", { required: "Selecciona el lugar de entrega" })}
        className="border p-2 rounded w-full"
      >
        <option value="">Selecciona el lugar</option>
        <option value="21">ALMACÉN IG</option>
        {selectedSitioId && (
          <option value={selectedSitioId}>
            {
              sitios.find(s => String(s.id) === String(selectedSitioId))?.nombre || "Sitio seleccionado"
            }
          </option>
        )}
      </select>
      {errors.lugar_entrega && (
        <span className="text-red-500">{errors.lugar_entrega.message}</span>
      )}
    </div>

      {/* Comentario general */}
      <div>
        <label htmlFor="comentario" className="block font-medium">Comentario general:</label>
        <input
          id="comentario"
          placeholder="Instrucciones especiales de la requisición"
          {...register("comentario")}
          className="border p-2 rounded w-full"
          defaultValue="Instrucciones especiales de la requisición"
        />
      </div>

  <Controller
        name="material"
        control={control}
        rules={{ required: "Selecciona un material" }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <Autocomplete
            options={materialesOptions}
            getOptionLabel={(option) => option.nombre || ''}
            loading={loading}
            onInputChange={(_, inputValue) => buscarMateriales(inputValue)}
            onChange={(_, selectedOption) => onChange(selectedOption)}
            value={value || null}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Material"
                error={!!error}
                helperText={error?.message}
                slotProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
          />
        )}
      />



      {/* Aquí irán el resto de los campos después */}

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Guardar requisición
      </button>
    </form>
  );
}

export default RequisicionForm;
