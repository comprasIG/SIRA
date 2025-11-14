// --- Importamos 'useCallback' ---
import { useEffect, useState, useCallback } from "react"; 
import axios from "axios";
import EditarProductoModal from "../components/EditarProductoModal"; 
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

// Usamos tu variable de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL;

const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unidadesMap, setUnidadesMap] = useState({});
  const [productoEditando, setProductoEditando] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
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

  // --- Definimos 'cargarDatos' FUERA del useEffect y con 'useCallback' ---
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);

      const peticionProductos = axios.get(`${API_BASE_URL}/api/catalogo_materiales`);
      const peticionUnidades = axios.get(`${API_BASE_URL}/api/catalogo_unidades`);

      const [respuestaProductos, respuestaUnidades] = await Promise.all([
        peticionProductos,
        peticionUnidades,
      ]);

      setProductos(respuestaProductos.data);

      const nuevoMapa = {};
      for (const u of respuestaUnidades.data) {
        nuevoMapa[u.id] = `${u.unidad} (${u.simbolo})`;
      }
      setUnidadesMap(nuevoMapa);

    } catch (error) {
      console.error("Error al cargar datos:", error);
      // Aquí puedes poner un toast de error
    } finally {
      setLoading(false);
    }
  }, []); // El array vacío de 'useCallback' dice que esta función nunca cambia

  // --- El useEffect ahora solo llama a 'cargarDatos' ---
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]); // Depende de 'cargarDatos' (que es estable gracias a useCallback)

  const handleEliminar = async (id) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/catalogo_materiales/${id}`);
      // Después de eliminar, volvemos a cargar los datos para refrescar la lista
      cargarDatos(); 
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  };

  // Filtrado (sin cambios)
  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Paginación (sin cambios)
  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
  const indexInicio = (paginaActual - 1) * productosPorPagina;
  const indexFin = indexInicio + productosPorPagina;
  const productosPagina = productosFiltrados.slice(indexInicio, indexFin);

  const paginas = [];
  const paginasAMostrar = 5; // Número máximo de páginas a mostrar en la paginación
  let inicioPaginas = Math.max(1, paginaActual - Math.floor(paginasAMostrar / 2));
  let finPaginas = Math.min(totalPaginas, inicioPaginas + paginasAMostrar - 1);
  
  // Ajustar si estamos cerca del inicio o final
  if (finPaginas - inicioPaginas + 1 < paginasAMostrar) {
    inicioPaginas = Math.max(1, finPaginas - paginasAMostrar + 1);
  }
  
  for (let i = inicioPaginas; i <= finPaginas; i++) {
    paginas.push(i);
  }

  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      {/* Header Mejorado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Catálogo de Productos</h2>
          <p className="text-gray-600 text-sm mt-1">
            Gestiona todos los productos de tu inventario
          </p>
        </div>
        <button
          onClick={cargarDatos}
          className="mt-3 lg:mt-0 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-md"
        >
          <RefreshIcon fontSize="small" />
          Actualizar
        </button>
      </div>

      {/* Barra de búsqueda y controles mejorada */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative w-full lg:w-auto flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              <SearchIcon fontSize="small" />
            </span>
            <input
              type="text"
              placeholder="Buscar por SKU o Nombre..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm transition-all"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex items-center space-x-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-300">
              <span className="text-gray-700 whitespace-nowrap">Mostrar:</span>
              <select
                value={productosPorPagina}
                onChange={(e) => {
                  setProductosPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="p-1 border-0 focus:outline-none focus:ring-0 bg-transparent"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
          <div className="text-blue-600 text-sm font-medium">Total Productos</div>
          <div className="text-2xl font-bold text-blue-700">{productos.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
          <div className="text-green-600 text-sm font-medium">Activos</div>
          <div className="text-2xl font-bold text-green-700">
            {productos.filter(p => p.activo).length}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
          <div className="text-purple-600 text-sm font-medium">Mostrando</div>
          <div className="text-2xl font-bold text-purple-700">
            {productosPagina.length} de {productosFiltrados.length}
          </div>
        </div>
      </div>

      {/* Tabla mejorada */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Unidad
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productosPagina.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {p.sku}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{p.nombre}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {unidadesMap[p.unidad_de_compra] || `ID: ${p.unidad_de_compra}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        p.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mr-2 ${
                          p.activo ? "bg-green-400" : "bg-red-400"
                        }`}
                      ></span>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => abrirModalEdicion(p)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 border border-blue-200 hover:border-blue-300"
                        title="Editar producto"
                      >
                        <EditIcon fontSize="small" />
                      </button>
                      <button
                        onClick={() => handleEliminar(p.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 border border-red-200 hover:border-red-300"
                        title="Eliminar producto"
                      >
                        <DeleteForeverIcon fontSize="small" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {productosPagina.length === 0 && (
            <div className="text-center py-12 bg-gray-50">
              <SearchIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron productos</h3>
              <p className="mt-1 text-sm text-gray-500">
                {busqueda ? "Intenta con otros términos de búsqueda." : "No hay productos en el catálogo."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Paginación mejorada */}
      <div className="flex flex-col lg:flex-row justify-between items-center mt-6 pt-4 border-t border-gray-200 gap-4">
        <p className="text-sm text-gray-600">
          Mostrando <span className="font-medium">{productosPagina.length}</span> de{" "}
          <span className="font-medium">{productosFiltrados.length}</span> productos • Página{" "}
          <span className="font-medium">{paginaActual}</span> de{" "}
          <span className="font-medium">{totalPaginas || 1}</span>
        </p>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <NavigateBeforeIcon fontSize="small" />
            Anterior
          </button>
          
          <div className="flex space-x-1">
            {paginas.map((num) => (
              <button
                key={num}
                onClick={() => setPaginaActual(num)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  paginaActual === num
                    ? "bg-blue-500 text-white shadow-md"
                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
          
          <button
            onClick={() =>
              setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))
            }
            disabled={paginaActual === totalPaginas || totalPaginas === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            Siguiente
            <NavigateNextIcon fontSize="small" />
          </button>
        </div>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <EditarProductoModal
          producto={productoEditando}
          onClose={cerrarModal}
          onUpdate={() => {
            cerrarModal();
            cargarDatos();
          }}
        />
      )}
    </div>
  );
};

export default ListaProductos;