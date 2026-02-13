// src/pages/NuevoUsuarioForm.jsx
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify"; // DESCOMENTAR EN PRODUCCIÓN
import api from "../api/api"; // DESCOMENTAR EN PRODUCCIÓN

// Iconos
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BadgeIcon from '@mui/icons-material/Badge';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import { CircularProgress } from "@mui/material";



export default function NuevoUsuarioForm({ onUsuarioCreado, usuarioAEditar }) {
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
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // 1. CARGA DE CATÁLOGOS
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        setLoadingCatalogos(true);
        const [rolesData, deptosData] = await Promise.all([
          api.get("/api/roles"),
          api.get("/api/departamentos")
        ]);
        
        // Ajuste para manejar respuestas de axios (data.data) o directas (data)
        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.data || []);
        setDepartamentos(Array.isArray(deptosData) ? deptosData : deptosData.data || []);

      } catch (error) {
        console.error("Error cargando catálogos:", error);
        toast.error("Error al cargar roles o departamentos.");
      } finally {
        setLoadingCatalogos(false);
      }
    };
    cargarCatalogos();
  }, []);

  // 2. RELLENAR FORMULARIO AL EDITAR
  useEffect(() => {
    if (!loadingCatalogos) {
      if (usuarioAEditar) {
        // Lógica para encontrar IDs si vienen nombres (o si vienen directos)
        let foundRoleId = usuarioAEditar.role_id || usuarioAEditar.role?.id;
        if (!foundRoleId && usuarioAEditar.rol && typeof usuarioAEditar.rol === 'string') {
            const roleMatch = roles.find(r => r.nombre.toLowerCase() === usuarioAEditar.rol.toLowerCase());
            if (roleMatch) foundRoleId = roleMatch.id;
        }

        let foundDeptoId = usuarioAEditar.departamento_id || usuarioAEditar.departamento?.id;
        if (!foundDeptoId && usuarioAEditar.departamento && typeof usuarioAEditar.departamento === 'string') {
            const deptoMatch = departamentos.find(d => d.nombre.toLowerCase() === usuarioAEditar.departamento.toLowerCase());
            if (deptoMatch) foundDeptoId = deptoMatch.id;
        }

        // Recuperar valores (Tu controlador espera 'nombre', pero la tabla a veces tiene 'nombre_completo')
        reset({
          nombre: usuarioAEditar.nombre_completo || usuarioAEditar.nombre || "", 
          correo: usuarioAEditar.correo || usuarioAEditar.email || "", 
          correo_google: usuarioAEditar.correo_google || "",
          whatsapp: usuarioAEditar.whatsapp || usuarioAEditar.telefono || "",
          role_id: foundRoleId || "", 
          departamento_id: foundDeptoId || "",
          activo: usuarioAEditar.activo ?? true, 
          es_superusuario: usuarioAEditar.es_superusuario ?? false,
        });
      } else {
        // Limpiar formulario para nuevo usuario
        reset({
          nombre: "",
          correo: "",
          correo_google: "",
          whatsapp: "",
          role_id: "",
          departamento_id: "",
          activo: true,
          es_superusuario: false,
        });
      }
    }
  }, [usuarioAEditar, reset, loadingCatalogos, roles, departamentos]);

  // 3. GUARDAR (CREAR O ACTUALIZAR)
  const onSubmit = async (data) => {
    try {
      // Aseguramos que los IDs sean números para que el Backend (Postgres/Int) no falle
      const payload = {
          ...data,
          role_id: Number(data.role_id),
          departamento_id: Number(data.departamento_id),
          // Enviamos whatsapp como null si está vacío, o el string si tiene datos
          whatsapp: data.whatsapp ? data.whatsapp : null 
      };

      if (usuarioAEditar && usuarioAEditar.id) {
        // EDITAR -> PUT /api/usuarios/:id
        await api.put(`/api/usuarios/${usuarioAEditar.id}`, payload);
        toast.success("Usuario actualizado correctamente.");
      } else {
        // CREAR -> POST /api/usuarios
        await api.post("/api/usuarios", payload);
        toast.success("Usuario creado correctamente.");
      }
      
      reset(); 
      if (onUsuarioCreado) onUsuarioCreado(); 
      
    } catch (err) {
      console.error("Error al guardar:", err);
      // Capturamos 'err.error' directamente si el wrapper lo devuelve así
      const mensaje = err.error || err.response?.data?.error || "Error al procesar la solicitud.";
      toast.error(mensaje);
    }
  };

  // 4. ELIMINAR
  const handleEliminar = async () => {
    if (!usuarioAEditar || !usuarioAEditar.id) return;
    
    if (window.confirm("¿Estás seguro de que deseas eliminar este usuario permanentemente?")) {
      try {
        setDeleting(true);
        
        // --- CORRECCIÓN DE BUG: Verificamos si api.delete existe ---
        const deleteFunc = api.delete || api.del; 
        
        if (typeof deleteFunc !== 'function') {
            throw new Error("El método DELETE no está definido en api.js. Revisa tu archivo de API.");
        }

        // ELIMINAR -> DELETE /api/usuarios/:id
        await deleteFunc(`/api/usuarios/${usuarioAEditar.id}`);
        
        toast.success("Usuario eliminado correctamente.");
        if (onUsuarioCreado) onUsuarioCreado();
      } catch (err) {
        console.error("Error al eliminar:", err);
        // Capturamos el mensaje de error correctamente
        const mensaje = err.error || err.message || err.response?.data?.error || "Error al eliminar el usuario.";
        toast.error(mensaje);
      } finally {
        setDeleting(false);
      }
    }
  };

  // --- ESTILOS VISUALES ---
  const labelStyle = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";
  const inputContainerStyle = "relative";
  const inputStyle = `
    w-full pl-3 pr-3 py-2.5 
    bg-gray-50 border border-gray-200 rounded-lg 
    text-gray-700 text-sm 
    focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 
    outline-none transition-all duration-200
  `;

  return (
    <div className="bg-white flex flex-col max-h-[85vh] w-full">
      {/* Encabezado Fijo */}
      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30 shrink-0">
        <div>
            <h2 className="text-xl font-bold text-gray-800">
            {usuarioAEditar ? "Editar Perfil" : "Nuevo Usuario"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
            {usuarioAEditar ? "Actualiza la información y permisos." : "Completa la información para dar de alta."}
            </p>
        </div>
        <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm ${usuarioAEditar ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'}`}>
            {usuarioAEditar ? <BadgeIcon fontSize="medium" /> : <PersonOutlineIcon fontSize="medium" />}
        </div>
      </div>

      {/* Cuerpo Scrollable */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
        {loadingCatalogos ? (
            <div className="flex flex-col justify-center items-center h-40 space-y-4">
                <CircularProgress size={30} className="text-indigo-600" />
                <p className="text-sm text-gray-400">Cargando datos...</p>
            </div>
        ) : (
            <form id="usuario-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-8">
                
                {/* GRUPO 1: DATOS PERSONALES */}
                <div>
                    <div className="flex items-center gap-2 mb-4 text-indigo-600 border-b border-indigo-50 pb-2">
                        <PersonOutlineIcon fontSize="small"/>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Información Personal</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-5">
                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Nombre Completo <span className="text-red-500">*</span></label>
                            <input
                            {...register("nombre", { required: "El nombre es obligatorio" })}
                            className={`${inputStyle} ${errors.nombre ? 'border-red-300 bg-red-50' : ''}`}
                            placeholder="Ej. Juan Pérez"
                            />
                            {errors.nombre && <span className="text-red-500 text-xs mt-1 block">{errors.nombre.message}</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>WhatsApp</label>
                                <input
                                {...register("whatsapp")}
                                type="tel"
                                className={inputStyle}
                                placeholder="55 1234 5678"
                                />
                            </div>
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>Correo Empresarial <span className="text-red-500">*</span></label>
                                <input
                                {...register("correo", { 
                                    required: "Requerido",
                                    pattern: { value: /^\S+@\S+$/i, message: "Formato Inválido" }
                                })}
                                type="email"
                                className={inputStyle}
                                placeholder="usuario@empresa.com"
                                />
                                {errors.correo && <span className="text-red-500 text-xs mt-1 block">{errors.correo.message}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* GRUPO 2: ACCESO */}
                <div>
                    <div className="flex items-center gap-2 mb-4 text-indigo-600 border-b border-indigo-50 pb-2">
                        <ContactPhoneIcon fontSize="small"/>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Cuenta de Acceso</h3>
                    </div>
                    <div className={inputContainerStyle}>
                        <label className={labelStyle}>Correo Google (Login) <span className="text-red-500">*</span></label>
                        <input
                        {...register("correo_google", { 
                            required: "Requerido para iniciar sesión",
                            pattern: { value: /^\S+@\S+$/i, message: "Formato Inválido" }
                        })}
                        type="email"
                        className={`${inputStyle} border-l-4 border-l-indigo-400`} 
                        placeholder="usuario@gmail.com"
                        />
                        <p className="text-xs text-gray-400 mt-1 ml-1">Este correo se usará para la autenticación única con Google.</p>
                        {errors.correo_google && <span className="text-red-500 text-xs mt-1 block">{errors.correo_google.message}</span>}
                    </div>
                </div>

                {/* GRUPO 3: PERMISOS */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-gray-700">
                        <WorkOutlineIcon fontSize="small"/>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Rol y Ubicación</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Rol del Sistema <span className="text-red-500">*</span></label>
                            <select {...register("role_id", { required: "Selecciona un rol" })} className={`${inputStyle} cursor-pointer`}>
                            <option value="">Seleccionar...</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                            </select>
                            {errors.role_id && <span className="text-red-500 text-xs mt-1 block">{errors.role_id.message}</span>}
                        </div>

                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Departamento <span className="text-red-500">*</span></label>
                            <select {...register("departamento_id", { required: "Selecciona un departamento" })} className={`${inputStyle} cursor-pointer`}>
                            <option value="">Seleccionar...</option>
                            {departamentos.map(d => (
                                <option key={d.id} value={d.id}>{d.nombre}</option>
                            ))}
                            </select>
                            {errors.departamento_id && <span className="text-red-500 text-xs mt-1 block">{errors.departamento_id.message}</span>}
                        </div>
                    </div>

                    {/* Switches */}
                    <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t border-gray-200">
                        <label className="flex items-center gap-3 cursor-pointer group select-none">
                            <div className="relative">
                                <input type="checkbox" {...register("activo")} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 transition-colors"></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Usuario Activo</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group select-none">
                            <div className="relative">
                                <input type="checkbox" {...register("es_superusuario")} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 transition-colors"></div>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 block">Superusuario</span>
                                <span className="text-[10px] text-gray-400 block">Acceso total al sistema</span>
                            </div>
                        </label>
                    </div>
                </div>

            </form>
        )}
      </div>

      {/* --- FOOTER FIJO --- */}
      <div className="px-8 py-5 border-t border-gray-200 bg-white flex justify-between items-center shrink-0 rounded-b-2xl">
        <div className="flex gap-2">
            <button
                type="button"
                onClick={() => reset()}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
                <CleaningServicesIcon fontSize="small"/>
                <span>Limpiar</span>
            </button>
            
            {/* BOTÓN ELIMINAR: Solo visible al editar */}
            {usuarioAEditar && (
                <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={deleting}
                    className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-red-50"
                >
                    {deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small"/>}
                    <span>Eliminar</span>
                </button>
            )}
        </div>

        <button
            form="usuario-form"
            type="submit"
            disabled={isSubmitting || loadingCatalogos}
            className={`
                flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-md transition-all duration-200 transform active:scale-95
                ${(isSubmitting || loadingCatalogos) 
                    ? 'bg-indigo-300 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 hover:shadow-lg shadow-indigo-200'}
            `}
        >
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon fontSize="small"/>}
            <span>{isSubmitting ? "Procesando..." : (usuarioAEditar ? "Guardar Cambios" : "Registrar Usuario")}</span>
        </button>
      </div>
    </div>
  );
}