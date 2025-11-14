// C:\SIRA\sira-front\src\components\G_OCForm\DatosGenerales.jsx
import React from 'react';
import { TextField, Autocomplete, CircularProgress } from '@mui/material';

const inputClass = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300';

export default function DatosGeneralesExtra({
  register,
  watch,
  setValue,
  errors,
  catalogos,
  loadingCatalogos,
}) {
  const sitioSeleccionado = watch('sitioSeleccionado');
  const proyectosFiltrados = catalogos.proyectos.filter((p) => !sitioSeleccionado || p.sitio_id === sitioSeleccionado.id);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Datos generales</h2>
        <p className="text-sm text-gray-500">Combina los campos de requisición y cotización permitiendo entradas libres.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Sitio</label>
          <Autocomplete
            options={catalogos.sitios}
            loading={loadingCatalogos}
            value={sitioSeleccionado || null}
            onChange={(_, value) => {
              setValue('sitioSeleccionado', value, { shouldDirty: true });
              if (value) {
                setValue('sitioNombre', value.nombre, { shouldDirty: true });
              }
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option?.nombre || ''}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Selecciona un sitio"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingCatalogos ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <input
            className={inputClass}
            placeholder="O escribe un sitio nuevo"
            {...register('sitioNombre', { required: 'El sitio es obligatorio' })}
          />
          {errors.sitioNombre && <span className="text-xs text-red-600">{errors.sitioNombre.message}</span>}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Proyecto</label>
          <Autocomplete
            options={proyectosFiltrados}
            loading={loadingCatalogos}
            value={watch('proyectoSeleccionado') || null}
            onChange={(_, value) => {
              setValue('proyectoSeleccionado', value, { shouldDirty: true });
              if (value) setValue('proyectoNombre', value.nombre, { shouldDirty: true });
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option?.nombre || ''}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Selecciona un proyecto"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingCatalogos ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <input
            className={inputClass}
            placeholder="O escribe un proyecto nuevo"
            {...register('proyectoNombre', { required: 'El proyecto es obligatorio' })}
          />
          {errors.proyectoNombre && <span className="text-xs text-red-600">{errors.proyectoNombre.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha requerida</label>
          <input type="date" className={inputClass} {...register('fechaRequerida', { required: 'La fecha es obligatoria' })} />
          {errors.fechaRequerida && <span className="text-xs text-red-600">{errors.fechaRequerida.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Lugar de entrega</label>
          <input className={inputClass} placeholder="Almacén, obra, etc." {...register('lugarEntrega', { required: 'Campo requerido' })} />
          {errors.lugarEntrega && <span className="text-xs text-red-600">{errors.lugarEntrega.message}</span>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Comentario general</label>
          <textarea rows={3} className={inputClass} placeholder="Comentarios u observaciones" {...register('comentario')} />
        </div>
      </div>
    </div>
  );
}
