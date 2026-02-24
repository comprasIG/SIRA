// C:\SIRA\sira-front\src\components\G_REQForm\DatosGenerales.jsx
import React, { useMemo } from "react";
import { Button, Chip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';

const inputStyle = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";
const ALMACEN_ID = "21";

export default function DatosGenerales({
  register, errors, watch, sitios, sitiosUnidades = [], proyectosFiltrados, handleSitioChange, handleProyectoChange,
  archivosAdjuntos, handleFileChange, handleRemoveFile,
  archivosExistentes, handleRemoveExistingFile, isUrgent, urgencyMessage
}) {

  const selectedSitioId = watch("sitio_id");

  const lugarEntregaOptions = useMemo(() => {
    const options = [{ id: ALMACEN_ID, nombre: 'ALMACÉN IG' }];
    if (selectedSitioId && String(selectedSitioId) !== ALMACEN_ID) {
      const sitioSeleccionado = sitios.find(s => String(s.id) === String(selectedSitioId));
      if (sitioSeleccionado) {
        options.push({ id: sitioSeleccionado.id, nombre: sitioSeleccionado.nombre });
      }
    }
    return options;
  }, [selectedSitioId, sitios]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
      <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">Datos Generales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Sitio */}
        <div>
          <label htmlFor="sitio_id" className="block text-sm font-medium text-gray-700">Sitio</label>
          <select id="sitio_id" {...register("sitio_id", { required: "Selecciona un sitio" })} className={inputStyle} onChange={handleSitioChange}>
            <option value="">Selecciona un sitio...</option>
            {sitios.map(sitio => (<option key={sitio.id} value={sitio.id}>{sitio.nombre}</option>))}
            {sitiosUnidades.map(s => (
              <option key={s.id} value="" disabled>{s.nombre} — gestionar desde la página Unidades</option>
            ))}
          </select>
          {errors.sitio_id && <span className="text-red-600 text-xs mt-1">{errors.sitio_id.message}</span>}
          {sitiosUnidades.length > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              ℹ️ Las requisiciones de servicio y refacciones para <strong>Unidades</strong> deben gestionarse desde la{' '}
              <a href="/unidades" className="underline font-medium hover:text-blue-700">página Unidades</a>.
            </p>
          )}
        </div>
        {/* Proyecto */}
        <div>
          <label htmlFor="proyecto_id" className="block text-sm font-medium text-gray-700">Proyecto</label>
          <select id="proyecto_id" {...register("proyecto_id", { required: "Selecciona un proyecto" })} className={inputStyle} onChange={handleProyectoChange}>
            <option value="">Selecciona un proyecto...</option>
            {proyectosFiltrados.map(proy => (<option key={proy.id} value={proy.id}>{proy.nombre}</option>))}
          </select>
          {errors.proyecto_id && <span className="text-red-600 text-xs mt-1">{errors.proyecto_id.message}</span>}
        </div>
        {/* Fecha Requerida */}
        <div>
          <label htmlFor="fecha_requerida" className="block text-sm font-medium text-gray-700">Fecha Requerida</label>
          <input id="fecha_requerida" type="date" {...register("fecha_requerida", { required: "La fecha es obligatoria" })} className={inputStyle} />
          {errors.fecha_requerida && <span className="text-red-600 text-xs mt-1">{errors.fecha_requerida.message}</span>}
        </div>
        {/* Lugar de Entrega */}
        <div>
          <label htmlFor="lugar_entrega" className="block text-sm font-medium text-gray-700">Lugar de Entrega</label>
          <select id="lugar_entrega" {...register("lugar_entrega", { required: "Selecciona el lugar" })} className={inputStyle}>
            <option value="">Selecciona el lugar...</option>
            {lugarEntregaOptions.map(opt => (<option key={opt.id} value={opt.id}>{opt.nombre}</option>))}
          </select>
          {errors.lugar_entrega && <span className="text-red-600 text-xs mt-1">{errors.lugar_entrega.message}</span>}
        </div>
        {/* Comentario General */}
        <div className="md:col-span-2">
          <label htmlFor="comentario" className="block text-sm font-medium text-gray-700">
            Comentario General {isUrgent ? "(Obligatorio)" : "(Opcional)"}
          </label>
          <input
            id="comentario"
            placeholder={isUrgent ? urgencyMessage : "Instrucciones especiales de la requisición..."}
            {...register("comentario", {
              validate: (value) => {
                if (isUrgent && (!value || value.trim() === "")) {
                  return urgencyMessage;
                }
                return true;
              }
            })}
            className={inputStyle}
            autoComplete="off"
            required={isUrgent}
          />
          {errors.comentario && (
            <span className="text-red-600 text-xs mt-1 block">{errors.comentario.message}</span>
          )}
        </div>
        {/* Adjuntar Archivos */}
        <div className="md:col-span-2">
          <label htmlFor="archivo" className="block text-sm font-medium text-gray-700">Adjuntar Archivos (máx. 5)</label>
          <div className="mt-1 flex flex-col items-start gap-4">
            <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} disabled={(archivosAdjuntos.length + (archivosExistentes?.length || 0)) >= 5}>
              Seleccionar Archivos
              <input type="file" multiple hidden onChange={handleFileChange} />
            </Button>

            {/* Mostrar archivos */}
            {((archivosExistentes?.length || 0) > 0 || archivosAdjuntos.length > 0) && (
              <div className="w-full p-3 border border-gray-200 rounded-md bg-gray-50">
                {/* Archivos existentes */}
                {archivosExistentes && archivosExistentes.length > 0 && (
                  <>
                    <p className="text-sm font-semibold mb-2">Archivos actuales:</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {archivosExistentes.map((file) => (
                        <Chip
                          key={file.id}
                          label={file.nombre_archivo}
                          onDelete={() => handleRemoveExistingFile(file.id)}
                          color="secondary"
                          variant="outlined"
                          component="a"
                          href={file.ruta_archivo}
                          target="_blank"
                          clickable
                        />
                      ))}
                    </div>
                  </>
                )}
                {/* Nuevos archivos a subir */}
                {archivosAdjuntos.length > 0 && (
                  <>
                    <p className="text-sm font-semibold mb-2">Nuevos archivos:</p>
                    <div className="flex flex-wrap gap-2">
                      {archivosAdjuntos.map((file, index) => (
                        <Chip key={index} label={file.name} onDelete={() => handleRemoveFile(file.name)} color="primary" variant="outlined" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}