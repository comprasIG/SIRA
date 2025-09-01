import { useEffect, useState } from "react";
import axios from "axios";
import EditarProductoModal from "../components/EditarProductoModal"; // ajusta la ruta si es necesario


const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [productoEditando, setProductoEditando] = useState(null);
const [mostrarModal, setMostrarModal] = useState(false);

const abrirModalEdicion = (producto) => {
  setProductoEditando(producto);
  setMostrarModal(true);
};

const cerrarModal = () => {
  setProductoEditando(null);
  setMostrarModal(false);
};

  const fetchProductos = async () => {
    try {
      const res = await axios.get("http://localhost:3001/api/catalogo_materiales");
      setProductos(res.data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const handleEliminar = async (id) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    try {
      await axios.delete(`http://localhost:3001/api/catalogo_materiales/${id}`);
      setProductos(productos.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  };

  //Objeto para poder colocar la unidad en vez del numero entero
  const unidadesMap = {
  1: "Pieza (PZ)",
  2: "Kilogramo (KG)",
  3: "Litro (L)",
  4: "Galón (GAL)",
  5: "Kit (KIT)",
  6: "Metro (M)",
  7: "Centímetro (CM)",
  8: "Milímetro (MM)",
  9: "Pulgada (IN)",
  10: "Tonelada (T)",
  91: "Par (PAR)",
  92: "Tramo (TM)",
};

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Catálogo de Productos</h2>
   
      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <table className="min-w-full bg-white shadow rounded-lg">
          <thead className="bg-gray-200 text-gray-700 text-left">
            <tr className="bg-gray-100 text-left">
              <th className="p-2">SKU</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Unidad</th>
              <th className="p-2">Activo</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-2">{p.sku}</td>
                <td className="p-2">{p.nombre}</td>

                {/*Linea en la tabla para poder convertir de numero a PZ,TM,M,etc.*/}
                <td className="p-2">{unidadesMap[p.unidad_de_compra]}</td>
                <td className="p-2">{p.activo ? "Sí" : "No"}</td>
                <td className="p-2 space-x-2">
                  <button
                    onClick={() => abrirModalEdicion(p)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                    Editar
                    </button>

                  <button
                    onClick={() => handleEliminar(p.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {mostrarModal && (
    <EditarProductoModal
    producto={productoEditando}
    onClose={cerrarModal}
    onUpdate={fetchProductos}
    />
)}
    </div>
  );
};

export default ListaProductos;