// src/components/NuevoUsuarioForm.jsx
import { useEffect, useState } from "react";
import api from "../api/api";
import { toast } from "react-toastify";

export default function NuevoUsuarioForm({ onUsuarioCreado }) {
  const [roles, setRoles] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    correo_google: "",
    whatsapp: "",
    role_id: "",
    departamento_id: "",
    es_superusuario: false,
    activo: true,
  });

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


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const nuevoUsuario = await api.post("/api/usuarios", form);
      toast.success("Usuario creado correctamente ✅");
        onUsuarioCreado?.(nuevoUsuario);
      setForm({
        nombre: "",
        correo: "",
        correo_google: "",
        whatsapp: "",
        role_id: "",
        departamento_id: "",
        es_superusuario: false,
        activo: true,
      });
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Error al crear usuario");
    }
  

  };

  return (
    <div className="max-w-2xl mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Agregar nuevo usuario</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
          <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required className="w-full border px-3 py-2 rounded shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Correo institucional</label>
          <input type="email" name="correo" value={form.correo} onChange={handleChange} required className="w-full border px-3 py-2 rounded shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Correo de Google (login)</label>
          <input type="email" name="correo_google" value={form.correo_google} onChange={handleChange} required className="w-full border px-3 py-2 rounded shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">WhatsApp (opcional)</label>
          <input type="text" name="whatsapp" value={form.whatsapp} onChange={handleChange} className="w-full border px-3 py-2 rounded shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Rol</label>
          <select name="role_id" value={form.role_id} onChange={handleChange} required className="w-full border px-3 py-2 rounded shadow-sm">
            <option value="">Selecciona un rol...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.nombre} ({r.codigo})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Departamento</label>
          <select name="departamento_id" value={form.departamento_id} onChange={handleChange} required className="w-full border px-3 py-2 rounded shadow-sm">
            <option value="">Selecciona un departamento...</option>
            {departamentos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.codigo})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 col-span-full sm:col-span-1">
          <input type="checkbox" name="es_superusuario" checked={form.es_superusuario} onChange={handleChange} />
          <label className="text-sm text-gray-700">¿Es superusuario?</label>
        </div>
        <div className="flex items-center gap-2 col-span-full sm:col-span-1">
          <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} />
          <label className="text-sm text-gray-700">¿Usuario activo?</label>
        </div>
        <div className="col-span-full text-right">
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
            Crear usuario
          </button>
        </div>
      </form>
    </div>
  );
}