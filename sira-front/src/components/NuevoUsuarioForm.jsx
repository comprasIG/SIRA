// src/components/NuevoUsuarioForm.jsx
// src/components/NuevoUsuarioForm.jsx
import { useEffect, useState } from "react";
import api from "../api/api";
import { toast } from "react-toastify";
// --- MEJORA: Íconos para una mejor experiencia de usuario ---
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

// --- MEJORA: Definir el estado inicial como constante para reutilizarlo en el reseteo ---
const initialFormState = {
  nombre: "",
  correo: "",
  correo_google: "",
  whatsapp: "",
  role_id: "",
  departamento_id: "",
  es_superusuario: false,
  activo: true,
};

export default function NuevoUsuarioForm({ onUsuarioCreado }) {
  const [roles, setRoles] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    (async () => {
      try {
        const [rolesData, deptosData] = await Promise.all([
          api.get("/api/roles"),
          api.get("/api/departamentos")
        ]);
        setRoles(rolesData);
        setDepartamentos(deptosData);
      } catch (err) {
        console.error("Error cargando roles/departamentos:", err);
        toast.error("No se pudieron cargar los roles o departamentos.");
      }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };
  
  // --- MEJORA: Función dedicada para limpiar el formulario ---
  const handleReset = () => {
    setForm(initialFormState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const nuevoUsuario = await api.post("/api/usuarios", form);
      toast.success("Usuario creado correctamente ✅");
      onUsuarioCreado?.(nuevoUsuario);
      handleReset(); // Se utiliza la nueva función de reseteo
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Error al crear usuario");
    }
  };

  // --- MEJORA: Estilo de inputs consistente con el archivo de referencia ---
  const inputStyle = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";

  return (
    // --- MEJORA: Contenedor principal con fondo gris claro para resaltar la "tarjeta" ---
    <div className="p-4 md:p-6 bg-gray-50">
        <form onSubmit={handleSubmit} autoComplete="off">
            {/* --- MEJORA: Estructura de "tarjeta" con sombra y padding --- */}
            <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
                
                {/* --- MEJORA: Título estilizado con borde inferior --- */}
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">
                    Agregar Nuevo Usuario
                </h2>
                
                {/* --- MEJORA: Grid layout para mejor alineación y responsividad --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
                        <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Correo institucional</label>
                        <input type="email" name="correo" value={form.correo} onChange={handleChange} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Correo de Google (login)</label>
                        <input type="email" name="correo_google" value={form.correo_google} onChange={handleChange} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">WhatsApp (opcional)</label>
                        <input type="text" name="whatsapp" value={form.whatsapp} onChange={handleChange} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Rol</label>
                        <select name="role_id" value={form.role_id} onChange={handleChange} required className={inputStyle}>
                            <option value="">Selecciona un rol...</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.nombre} ({r.codigo})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Departamento</label>
                        <select name="departamento_id" value={form.departamento_id} onChange={handleChange} required className={inputStyle}>
                            <option value="">Selecciona un departamento...</option>
                            {departamentos.map(d => (
                                <option key={d.id} value={d.id}>{d.nombre} ({d.codigo})</option>
                            ))}
                        </select>
                    </div>

                    {/* --- MEJORA: Checkboxes alineados y estilizados --- */}
                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="es_superusuario" checked={form.es_superusuario} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <label className="text-sm font-medium text-gray-700">¿Es superusuario?</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <label className="text-sm font-medium text-gray-700">¿Usuario activo?</label>
                    </div>
                </div>
            </div>

            {/* --- MEJORA: Sección de acciones separada y con botones estilizados --- */}
            <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-6 mt-6 border-t-2 border-gray-200">
                <button
                    type="button"
                    onClick={handleReset}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 transform hover:scale-105"
                >
                    <CleaningServicesIcon />
                    Limpiar
                </button>
                <button
                    type="submit"
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                >
                    <AddCircleOutlineIcon />
                    Crear Usuario
                </button>
            </div>
        </form>
    </div>
  );
}