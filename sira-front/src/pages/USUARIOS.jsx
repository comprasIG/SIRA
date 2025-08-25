// src/pages/USUARIOS.jsx

import { useEffect, useState } from "react";
import api from "../api/api";

import NuevoUsuarioForm from "../components/NuevoUsuarioForm";

export default function USUARIOS() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

const cargarUsuarios = async () => {
  try {
    const data = await api.get("/api/usuarios");
    setUsuarios(data);
  } catch (err) {
    console.error("Error al cargar usuarios:", err);
  }
};

  useEffect(() => {
  cargarUsuarios().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">Cargando usuarios...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Usuarios del sistema</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white shadow rounded-lg">
          <thead className="bg-gray-200 text-gray-700 text-left">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Correo</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Funciones permitidas</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">{u.nombre_completo}</td>
                <td className="px-4 py-3">{u.correo_google}</td>
                <td className="px-4 py-3 font-medium">{u.rol}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {u.funciones.map((f, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

<NuevoUsuarioForm onUsuarioCreado={cargarUsuarios} />



      </div>
    </div>
  );
}
