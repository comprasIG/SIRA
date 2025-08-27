// src/pages/NuevoUsuarioForm.jsx
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import api from "../api/api";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import { CircularProgress } from "@mui/material";

export default function NuevoUsuarioForm({ onUsuarioCreado }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      nombre: "",
      correo: "",
      correo_google: "",
      whatsapp: "",
      role_id: "",
      departamento_id: "",
      activo: true,
      es_superusuario: false,
    }
  });

  const [roles, setRoles] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  // MEJORA: Se utiliza Promise.all para cargar los datos en paralelo.
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [rolesData, deptosData] = await Promise.all([
          api.get("/api/roles"),
          api.get("/api/departamentos")
        ]);
        setRoles(rolesData);
        setDepartamentos(deptosData);
      } catch (error) {
        toast.error("Error al cargar datos necesarios para el formulario.");
        console.error(error);
      }
    };
    cargarDatos();
  }, []);

  const onSubmit = async (data) => {
    try {
      // El payload ya tiene los tipos de dato correctos gracias a react-hook-form
      await api.post("/api/usuarios", data);
      toast.success("Usuario creado correctamente.");
      reset(); // Resetea el formulario a sus valores por defecto
      if (onUsuarioCreado) onUsuarioCreado();
    } catch (err) {
      toast.error(err?.error || "Error al crear el usuario.");
      console.error(err);
    }
  };

  // MEJORA: Estilo consistente para los inputs
  const inputStyle = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";

  return (
    // MEJORA: Contenedor principal para dar contexto visual a la tarjeta
    <div className="p-4 md:p-6 bg-gray-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 space-y-6"
        autoComplete="off"
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4 border-b-2 border-gray-200 pb-3">
          Registrar Nuevo Usuario
        </h2>

        {/* MEJORA: Grid responsivo para los campos del formulario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <label className="block font-medium mb-1 text-gray-700">Nombre completo</label>
            <input
              {...register("nombre", { required: "El nombre es obligatorio" })}
              className={inputStyle}
            />
            {errors.nombre && <span className="text-red-600 text-xs">{errors.nombre.message}</span>}
          </div>

          <div>
            <label className="block font-medium mb-1 text-gray-700">WhatsApp (opcional)</label>
            <input
              {...register("whatsapp")}
              type="tel"
              className={inputStyle}
            />
          </div>
          
          <div>
            <label className="block font-medium mb-1 text-gray-700">Correo (empresa)</label>
            <input
              {...register("correo", { 
                required: "El correo es obligatorio",
                pattern: { value: /^\S+@\S+$/i, message: "Formato de correo inválido" }
              })}
              type="email"
              className={inputStyle}
            />
            {errors.correo && <span className="text-red-600 text-xs">{errors.correo.message}</span>}
          </div>

          <div>
            <label className="block font-medium mb-1 text-gray-700">Correo Google (para login)</label>
            <input
              {...register("correo_google", { 
                required: "El correo de Google es obligatorio",
                pattern: { value: /^\S+@\S+$/i, message: "Formato de correo inválido" }
               })}
              type="email"
              className={inputStyle}
            />
            {errors.correo_google && <span className="text-red-600 text-xs">{errors.correo_google.message}</span>}
          </div>

          <div>
            <label className="block font-medium mb-1 text-gray-700">Rol</label>
            <select {...register("role_id", { required: "Debes seleccionar un rol" })} className={inputStyle}>
              <option value="">Selecciona un rol...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            {errors.role_id && <span className="text-red-600 text-xs">{errors.role_id.message}</span>}
          </div>

          <div>
            <label className="block font-medium mb-1 text-gray-700">Departamento</label>
            <select {...register("departamento_id", { required: "Debes seleccionar un departamento" })} className={inputStyle}>
              <option value="">Selecciona un departamento...</option>
              {departamentos.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
            {errors.departamento_id && <span className="text-red-600 text-xs">{errors.departamento_id.message}</span>}
          </div>

          {/* MEJORA: Checkboxes con mejor estilo y alineación */}
          <div className="md:col-span-2 flex gap-8 items-center mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("activo")} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
              <span>Activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("es_superusuario")} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
              <span>Es Superusuario</span>
            </label>
          </div>
        </div>
        
        {/* MEJORA: Sección de acciones con botones estilizados */}
        <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-6 mt-6 border-t-2 border-gray-200">
            <button
                type="button"
                onClick={() => reset()}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 transform hover:scale-105"
            >
              <CleaningServicesIcon fontSize="small"/>
              Limpiar
            </button>
            <button
                type="submit"
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                disabled={isSubmitting}
            >
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : <AddCircleOutlineIcon />}
                <span>{isSubmitting ? "Guardando..." : "Registrar Usuario"}</span>
            </button>
        </div>
      </form>
    </div>
  );
}