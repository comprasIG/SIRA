import { useEffect, useState, useCallback } from "react"; 
import axios from "axios";
import EditarProductoModal from "../components/EditarProductoModal"; 

// ICONOS
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from "@mui/icons-material/Close";
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Variable de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL;

const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unidadesMap, setUnidadesMap] = useState({});
  const [productoEditando, setProductoEditando] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Estados de paginación y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [productosPorPagina, setProductosPorPagina] = useState(10);

  const abrirModalEdicion = (producto) => {
    setProductoEditando(producto);
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setProductoEditando(null);
    setMostrarModal(false);
  };

  // --- CARGA DE DATOS ---
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resProductos, resUnidades] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/catalogo_materiales`),
        axios.get(`${API_BASE_URL}/api/catalogo_unidades`),
      ]);

      setProductos(Array.isArray(resProductos.data) ? resProductos.data : []);

      const nuevoMapa = {};
      if (Array.isArray(resUnidades.data)) {
        for (const u of resUnidades.data) {
          nuevoMapa[u.id] = `${u.unidad} (${u.simbolo})`;
        }
      }
      setUnidadesMap(nuevoMapa);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleEliminar = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/catalogo_materiales/${id}`);
      cargarDatos(); 
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  // --- LÓGICA DE FILTRADO Y PAGINACIÓN ---
  const productosFiltrados = productos.filter((p) => {
    if (!p) return false;
    const nombre = p.nombre ? p.nombre.toString().toLowerCase() : '';
    const sku = p.sku ? p.sku.toString().toLowerCase() : '';
    const termino = busqueda.toLowerCase().trim();
    if (!termino) return true;
    return nombre.includes(termino) || sku.includes(termino);
  });

  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
  const indexInicio = (paginaActual - 1) * productosPorPagina;
  const indexFin = indexInicio + productosPorPagina;
  const productosPagina = productosFiltrados.slice(indexInicio, indexFin);

  const paginas = [];
  const paginasAMostrar = 5;
  let inicioPaginas = Math.max(1, paginaActual - Math.floor(paginasAMostrar / 2));
  let finPaginas = Math.min(totalPaginas, inicioPaginas + paginasAMostrar - 1);
  
  if (finPaginas - inicioPaginas + 1 < paginasAMostrar) {
    inicioPaginas = Math.max(1, finPaginas - paginasAMostrar + 1);
  }
  for (let i = inicioPaginas; i <= finPaginas; i++) paginas.push(i);

  const formatearDinero = (cantidad, moneda) => {
    if (cantidad === null || cantidad === undefined) return '-';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: moneda || 'MXN'
    }).format(cantidad);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      
      {/* --- ENCABEZADO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Catálogo de Productos</h1>
          <p className="text-slate-500 mt-1 text-sm">Gestiona y monitorea tu inventario global.</p>
        </div>
        <button
          onClick={cargarDatos}
          className="group flex items-center justify-center gap-2 bg-white text-slate-700 px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all duration-300 font-medium"
        >
          <RefreshIcon className="text-slate-400 group-hover:text-blue-500 transition-colors" fontSize="small" />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {/* --- TARJETAS KPI (ESTADÍSTICAS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Card Total */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute right-0 top-0 h-full w-1 bg-blue-500 rounded-r-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Items</p>
            <h3 className="text-3xl font-bold text-slate-800">{productos.length}</h3>
          </div>
          <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <Inventory2Icon />
          </div>
        </div>

        {/* Card Activos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500 rounded-r-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Productos Activos</p>
            <h3 className="text-3xl font-bold text-slate-800">{productos.filter(p => p && p.activo).length}</h3>
          </div>
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <CheckCircleIcon />
          </div>
        </div>

        {/* Card Valor (o Resultados) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute right-0 top-0 h-full w-1 bg-violet-500 rounded-r-2xl"></div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">En Vista Actual</p>
            <h3 className="text-3xl font-bold text-slate-800">{productosFiltrados.length}</h3>
          </div>
          <div className="h-12 w-12 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
            <SearchIcon />
          </div>
        </div>
      </div>

      {/* --- CONTENEDOR PRINCIPAL --- */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden">
        
        {/* Barra de Herramientas */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
          
          {/* Buscador */}
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="text-slate-400" fontSize="small" />
            </div>
            <input
              type="text"
              placeholder="Buscar por SKU, Nombre o Descripción..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              className="pl-10 pr-10 py-2.5 w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
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

          {/* Selector de Filas */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mostrar:</span>
            <div className="relative">
              <select
                value={productosPorPagina}
                onChange={(e) => {
                  setProductosPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer font-medium hover:border-slate-300 transition-colors"
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
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-500 text-sm animate-pulse">Cargando inventario...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Nombre</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Unidad</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ultimo Precio</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Moneda</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {productosPagina.map((p, index) => (
                  <tr key={`${p.id}-${index}`} className="group hover:bg-slate-50/80 transition-colors duration-200">
                    
                    {/* SKU */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono group-hover:bg-white group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                        {p.sku}
                      </span>
                    </td>

                    {/* Nombre */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 line-clamp-2" title={p.nombre}>
                        {p.nombre}
                      </div>
                    </td>

                    {/* Unidad */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-1 bg-slate-50 text-slate-500 rounded border border-slate-100">
                        {unidadesMap[p.unidad_de_compra] || p.unidad_de_compra}
                      </span>
                    </td>
                    
                    {/* Precio */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-700 font-mono tracking-tight">
                        {formatearDinero(p.ultimo_precio_entrada, p.moneda)}
                      </div>
                    </td>
                    
                    {/* Moneda */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                        p.moneda === 'USD' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : p.moneda === 'MXN' 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {p.moneda || 'N/A'}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {p.activo ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => abrirModalEdicion(p)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <EditIcon fontSize="small" />
                        </button>
                        <button 
                          onClick={() => handleEliminar(p.id)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <DeleteForeverIcon fontSize="small" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Estado Vacío */}
            {productosPagina.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-3">
                  <SearchIcon className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-medium mb-1">No se encontraron productos</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  {busqueda 
                    ? `No hay resultados para "${busqueda}". Intenta con otro término o SKU.`
                    : "Tu inventario está vacío. Comienza agregando nuevos materiales."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- PAGINACIÓN --- */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{productosPagina.length}</span> de <span className="font-semibold text-slate-700">{productosFiltrados.length}</span> resultados
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <NavigateBeforeIcon fontSize="small" />
            </button>
            
            <div className="hidden sm:flex gap-1 px-2">
              {paginas.map(num => (
                <button
                  key={num}
                  onClick={() => setPaginaActual(num)}
                  className={`min-w-[32px] h-8 flex items-center justify-center text-xs font-medium rounded-lg transition-colors ${
                    paginaActual === num 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas || totalPaginas === 0}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <NavigateNextIcon fontSize="small" />
            </button>
          </div>
        </div>
      </div>

      {mostrarModal && (
        <EditarProductoModal
          producto={productoEditando}
          onClose={cerrarModal}
          onUpdate={() => { cerrarModal(); cargarDatos(); }}
        />
      )}
    </div>
  );
};

export default ListaProductos;