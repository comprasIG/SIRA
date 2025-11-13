// --- Importamos 'useCallback' ---
import { useEffect, useState, useCallback } from "react"; 
import axios from "axios";
import EditarProductoModal from "../components/EditarProductoModal"; 
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import SearchIcon from '@mui/icons-material/Search';

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
  for (let i = 1; i <= totalPaginas; i++) {
    paginas.push(i);
  }

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md">
      {/* Título (sin cambios) */}
      <h2 className="text-2xl font-bold text-left text-gray-800 mb-4 border-b-2 border-gray-200 pb-3">
        Catálogo de Productos
      </h2>

      {/* Barra de búsqueda y selector (sin cambios) */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-1/2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
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
            className="w-full pl-10 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span>Mostrar:</span>
          <select
            value={productosPorPagina}
            onChange={(e) => {
              setProductosPorPagina(Number(e.target.value));
              setPaginaActual(1);
            }}
            className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>por página</span>
        </div>
      </div>

      {/* Tabla (sin cambios) */}
      {loading ? (
        <p className="text-gray-500">Cargando productos...</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-200 text-gray-800 text-left text-sm uppercase tracking-wide">
                <th className="p-3 font-semibold">SKU</th>
                <th className="p-3 font-semibold">Nombre</th>
                <th className="p-3 font-semibold">Unidad</th>
                <th className="p-3 font-semibold">Activo</th>
                <th className="p-3 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosPagina.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition-colors border-b border-gray-200"
                >
                  <td className="p-3 text-gray-900 font-medium">{p.sku}</td>
                  <td className="p-3 text-gray-700">{p.nombre}</td>
                  <td className="p-3 text-gray-700">
                    {unidadesMap[p.unidad_de_compra] || `ID: ${p.unidad_de_compra}`}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        p.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {p.activo ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-2">
                    <button
                      onClick={() => abrirModalEdicion(p)}
                      className="p-2 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => handleEliminar(p.id)}
                      className="p-2 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition"
                    >
                      <DeleteForeverIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación (sin cambios) */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
        <p className="text-sm text-gray-600">
          Página {paginaActual} de {totalPaginas || 1} —{" "}
          Mostrando {productosPagina.length} de {productosFiltrados.length} productos
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            <NavigateBeforeIcon/>
            Anterior
          </button>
          {paginas.map((num) => (
            <button
              key={num}
              onClick={() => setPaginaActual(num)}
              className={`px-3 py-1 rounded ${
                paginaActual === num
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {num}
            </button>
          ))}
          <button
            onClick={() =>
              setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))
            }
            disabled={paginaActual === totalPaginas || totalPaginas === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Siguiente
            <NavigateNextIcon/>
          </button>
        </div>
      </div>

      {/* --- 'onUpdate' ahora es mucho más simple --- */}
      {mostrarModal && (
        <EditarProductoModal
          producto={productoEditando}
          onClose={cerrarModal}
          onUpdate={() => {
            cerrarModal(); // Cierra el modal
            cargarDatos(); // Vuelve a cargar los datos (¡Ahora sí funciona!)
          }}
        />
      )}
    </div>
  );
};

export default ListaProductos;