// src/pages/USUARIOS.jsx

import { useEffect, useState, useMemo } from "react";

// --- IMPORTACIONES REALES (DESCOMENTAR EN TU PROYECTO) ---
import api from "../api/api";
import NuevoUsuarioForm from "../components/NuevoUsuarioForm";

// ICONOS MATERIAL UI
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import DisabledByDefaultRoundedIcon from '@mui/icons-material/DisabledByDefaultRounded';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
// Nuevos iconos para acciones
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';



export default function USUARIOS() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [usuariosPorPagina, setUsuariosPorPagina] = useState(10);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Nuevo estado para controlar la edición
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);

  // --- CARGA DE DATOS REALES ---
  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/usuarios");
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // --- ACCIONES: CREAR, EDITAR, ELIMINAR ---
  const handleAbrirCrear = () => {
    setUsuarioAEditar(null); // Limpiamos para crear uno nuevo
    setMostrarModal(true);
  };

  const handleAbrirEditar = (usuario) => {
    setUsuarioAEditar(usuario); // Pasamos el usuario seleccionado
    setMostrarModal(true);
  };


  // --- LÓGICA DE FILTRADO ---
  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.toLowerCase();
    return usuarios.filter(
      (u) =>
        u.nombre_completo.toLowerCase().includes(termino) ||
        u.correo_google.toLowerCase().includes(termino) ||
        u.rol.toLowerCase().includes(termino)
    );
  }, [usuarios, busqueda]);

  // --- KPIS (CÁLCULOS DINÁMICOS) ---
  const kpis = useMemo(() => {
    const total = usuarios.length;
    const rolesUnicos = [...new Set(usuarios.map(u => u.rol))].length;
    const enVista = usuariosFiltrados.length;
    return { total, rolesUnicos, enVista };
  }, [usuarios, usuariosFiltrados]);

  // --- PAGINACIÓN ---
  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);
  const indexInicio = (paginaActual - 1) * usuariosPorPagina;
  const indexFin = indexInicio + usuariosPorPagina;
  const usuariosPagina = usuariosFiltrados.slice(indexInicio, indexFin);

  // --- ESTILOS DE ROL UNIFICADOS ---
  const getRolColor = () => {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  const getRolIcon = () => {
    return <SecurityIcon fontSize="small" sx={{ fontSize: 16 }} />;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 font-sans text-slate-800">
      
      {/* --- ENCABEZADO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 mt-1 text-sm">Administra los accesos y roles del sistema.</p>
        </div>
        <button
          onClick={handleAbrirCrear}
          className="group flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-300 font-medium"
        >
          <AddIcon fontSize="small" className="group-hover:scale-110 transition-transform" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* --- KPIS (TARJETAS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* KPI 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500 rounded-l-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Usuarios</p>
            <h3 className="text-3xl font-bold text-slate-800">{kpis.total}</h3>
          </div>
          <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <GroupIcon />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 h-full w-1 bg-purple-500 rounded-l-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Roles Definidos</p>
            <h3 className="text-3xl font-bold text-slate-800">{kpis.rolesUnicos}</h3>
          </div>
          <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <SecurityIcon />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500 rounded-l-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Resultados Búsqueda</p>
            <h3 className="text-3xl font-bold text-slate-800">{kpis.enVista}</h3>
          </div>
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <VisibilityIcon />
          </div>
        </div>
      </div>

      {/* --- CONTENEDOR DE LA TABLA --- */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
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
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
            />
            {busqueda && (
              <button
                onClick={() => { setBusqueda(""); setPaginaActual(1); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <CloseIcon fontSize="small" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase">Mostrar:</span>
            <div className="relative">
              <select
                value={usuariosPorPagina}
                onChange={(e) => {
                  setUsuariosPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value={10}>10 filas</option>
                <option value={20}>20 filas</option>
                <option value={50}>50 filas</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-500 font-medium bg-slate-50/20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
            Cargando usuarios...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Usuario</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Funciones Asignadas</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {usuariosPagina.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-16 text-slate-400 italic bg-slate-50/20">
                      <SearchIcon className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                      <p>No se encontraron usuarios que coincidan con "{busqueda}".</p>
                    </td>
                  </tr>
                ) : (
                  usuariosPagina.map((u, index) => (
                    <tr
                      key={u.id || index}
                      className="hover:bg-slate-50/80 transition-colors duration-200 group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors ring-2 ring-transparent group-hover:ring-indigo-50">
                            <AccountCircleIcon fontSize="large" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{u.nombre_completo}</div>
                            <div className="text-xs text-slate-500">{u.correo_google}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getRolColor()}`}>
                          {getRolIcon()}
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {u.funciones && u.funciones.length > 0 ? (
                            u.funciones.map((f, i) => (
                              <span key={i} className="bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-white hover:border-slate-300 transition-colors">
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs italic flex items-center gap-1">
                              <DisabledByDefaultRoundedIcon fontSize="small" style={{ fontSize: 14 }} />
                              Sin funciones específicas
                            </span>
                          )}
                        </div>
                      </td>
                      {/* --- COLUMNA DE ACCIONES --- */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleAbrirEditar(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group-hover:opacity-100"
                            title="Editar usuario"
                          >
                            <EditIcon fontSize="small" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{usuariosPagina.length}</span> de <span className="font-semibold text-slate-700">{usuariosFiltrados.length}</span> usuarios
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaActual === 1}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <NavigateBeforeIcon fontSize="small" /> Anterior
            </button>

            <span className="text-sm font-medium text-slate-600 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
              Página {paginaActual} de {totalPaginas || 1}
            </span>

            <button
              onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={paginaActual === totalPaginas || totalPaginas === 0}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              Siguiente <NavigateNextIcon fontSize="small" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMostrarModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 transform transition-all scale-100 opacity-100">
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-all"
            >
              <CloseIcon />
            </button>
            <NuevoUsuarioForm
              key={usuarioAEditar ? usuarioAEditar.id : 'nuevo'}
              usuarioAEditar={usuarioAEditar}
              onUsuarioCreado={() => {
                cargarUsuarios();
                setMostrarModal(false);
                setUsuarioAEditar(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}