// src/pages/USUARIOS.jsx

import { useEffect, useState } from "react";
import api from "../api/api";
import NuevoUsuarioForm from "../components/NuevoUsuarioForm";
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import DisabledByDefaultRoundedIcon from '@mui/icons-material/DisabledByDefaultRounded';

export default function USUARIOS() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [usuariosPorPagina, setUsuariosPorPagina] = useState(10);
  const [mostrarModal, setMostrarModal] = useState(false);

  const cargarUsuarios = async () => {
    try {
      const data = await api.get("/api/usuarios");
      setUsuarios(data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const usuariosFiltrados = usuarios.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.correo_google.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.rol.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);
  const indexInicio = (paginaActual - 1) * usuariosPorPagina;
  const indexFin = indexInicio + usuariosPorPagina;
  const usuariosPagina = usuariosFiltrados.slice(indexInicio, indexFin);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500 font-medium">
        Cargando usuarios...
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-700">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0 border-b border-gray-200 pb-2">
          Usuarios del sistema
        </h1>
        <button
          onClick={() => setMostrarModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-medium shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <AddIcon fontSize="small" />
          Nuevo usuario
        </button>
      </div>

      {/* Barra de búsqueda + Selector por página */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-1/2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
            <SearchIcon fontSize="small" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, correo o rol..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
            className="w-full pl-10 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span>Mostrar:</span>
          <select
            value={usuariosPorPagina}
            onChange={(e) => {
              setUsuariosPorPagina(Number(e.target.value));
              setPaginaActual(1);
            }}
            className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>por página</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white shadow-md rounded-2xl border border-gray-100">
        <table className="min-w-full text-sm sm:text-base">
          <thead>
            <tr className="bg-gray-50 text-gray-600 uppercase text-xs sm:text-sm">
              <th className="px-4 py-3 text-left font-semibold">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold">Correo</th>
              <th className="px-4 py-3 text-left font-semibold">Rol</th>
              <th className="px-4 py-3 text-left font-semibold">Funciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosPagina.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-400 italic">
                  No hay usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              usuariosPagina.map((u, index) => (
                <tr
                  key={u.id}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } border-b border-gray-200 hover:bg-indigo-50 transition-colors`}
                >
                  <td className="px-4 py-3 text-gray-800 font-medium">{u.nombre_completo}</td>
                  <td className="px-4 py-3 text-gray-600">{u.correo_google}</td>
                  <td className="px-4 py-3 text-indigo-700 font-semibold">{u.rol}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.funciones.map((f, i) => (
                        <span key={i} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3">
        <p className="text-sm text-gray-600">
          Página {paginaActual} de {totalPaginas || 1} — Mostrando {usuariosPagina.length} de {usuariosFiltrados.length} usuarios
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1}
            className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-300 transition"
          >
            <NavigateBeforeIcon fontSize="small" /> Anterior
          </button>

          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setPaginaActual(num)}
              className={`px-3 py-1 rounded-md ${
                paginaActual === num
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300 transition"
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas || totalPaginas === 0}
            className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-300 transition"
          >
            Siguiente <NavigateNextIcon fontSize="small" />
          </button>
        </div>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 opacity-100"
            onClick={() => setMostrarModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 transform transition-all duration-300 scale-100 opacity-100">
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition"
            >
              <DisabledByDefaultRoundedIcon />
            </button>
            <NuevoUsuarioForm
              onUsuarioCreado={() => {
                cargarUsuarios();
                setMostrarModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
