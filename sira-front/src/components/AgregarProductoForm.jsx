//D:\SIRA\SIRA\sira-front\src\components\AgregarProductoForm.jsx

// --- MODIFICADO --- Se añaden 'useState' y 'useEffect'
import { useState, useEffect } from "react";
import axios from "axios";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import { toast } from "react-toastify";

// --- LECTURA DE LA VARIABLE DE ENTORNO ---
const API_BASE_URL = import.meta.env.VITE_API_URL; 

if (!import.meta.env.VITE_API_URL) {
  console.warn("ADVERTENCIA: VITE_API_URL no está definida en tu archivo .env. Usando http://localhost:3001 como respaldo.");
}
// --- --- --- --- ---

const inputStyle =
  "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300 read-only:bg-gray-100";

// --- ESTADO INICIAL ---
const initialState = {
  tipo: "",
  categoria: "",
  detalle: "",
  sku: "",
  unidad_de_compra: "", // Se queda como string vacío
  activo: true,
};

const AgregarProductoForm = () => {
  const [formData, setFormData] = useState(initialState);
  
  // --- NUEVO ESTADO ---
  // 1. Estado para guardar las unidades que vienen de la API
  const [unidades, setUnidades] = useState([]);

  // --- NUEVO HOOK ---
  // 2. useEffect para cargar las unidades cuando el componente se monta
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        const url = `${API_BASE_URL}/api/catalogo_unidades`;
        const respuesta = await axios.get(url);
        setUnidades(respuesta.data); // Guardamos el array de unidades
      } catch (error) {
        console.error("Error al cargar unidades:", error);
        toast.error("Error: No se pudieron cargar las unidades de medida.");
      }
    };

    cargarUnidades();
  }, []); // El array vacío [] asegura que solo se ejecute una vez

  // --- Generación de nombre (sin cambios) ---
  const nombreGenerado = [formData.tipo, formData.categoria, formData.detalle]
    .filter(Boolean)
    .join(" ");

  // --- MODIFICADO ---
  // 3. Lógica de 'handleChange' simplificada
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    let parsedValue;

    if (type === "checkbox") {
      parsedValue = checked;
    } else {
      // El valor del select (unidad_de_compra) no se pasa a mayúsculas
      parsedValue = (name === 'unidad_de_compra') ? value : value.toUpperCase();
    }
    
    setFormData({
      ...formData,
      [name]: parsedValue,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      
      // --- MODIFICADO ---
      // 4. Aseguramos que 'unidad_de_compra' se envíe como NÚMERO
      const payload = {
        ...formData,
        nombre: nombreGenerado,
        ultimo_precio: 0,
        unidad_de_compra: parseInt(formData.unidad_de_compra, 10)
      };

      const url = `${API_BASE_URL}/api/catalogo_materiales`;

      console.log("Enviando petición a:", url);
      console.log("Payload:", payload);

      await axios.post(url, payload);

      toast.success("Producto agregado correctamente");
      setFormData(initialState);

    } catch (error) {
      console.error("Error al agregar producto:", error);

      if (error.code === "ERR_NETWORK") {
        toast.error(`Error de Red: No se pudo conectar a ${API_BASE_URL}.`);
      } else if (error.response) {
        const message = error.response.data?.message || "Error del servidor.";
        toast.error(`Error ${error.response.status}: ${message}`);
      } else {
        toast.error("Hubo un error al guardar. Revisa la consola.");
      }
    }
  };

  const limpiarFormulario = () => {
    setFormData(initialState);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 p-4 md:p-6 bg-gray-50"
      autoComplete="off"
    >
      {/* --- SECCIÓN DE DATOS DEL PRODUCTO --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-6">
          Datos del Producto
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* Tipo */}
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
              Tipo
            </label>
            <input
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="CODO"
            />
          </div>

          {/* Categoría */}
          <div>
            <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
              Categoría
            </label>
            <input
              id="categoria"
              name="categoria"
              value={formData.categoria}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="INOX SOLD. T304"
            />
          </div>

          {/* Detalle */}
          <div>
            <label htmlFor="detalle" className="block text-sm font-medium text-gray-700">
              Detalle
            </label>
            <input
              id="detalle"
              name="detalle"
              value={formData.detalle}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="4 x 90°"
            />
          </div>

          {/* SKU */}
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="AC.CS05"
            />
          </div>

          {/* --- SECCIÓN MODIFICADA --- */}
          {/* 5. Unidad de Medida (Dinámico desde la API) */}
          <div>
            <label htmlFor="unidad_de_compra" className="block text-sm font-medium text-gray-700">
              Unidad De Medida
            </label>
            <select
              id="unidad_de_compra"
              name="unidad_de_compra"
              value={formData.unidad_de_compra}
              onChange={handleChange}
              required
              className={inputStyle}
            >
              {/* Opción default */}
              <option value="">Selecciona una unidad...</option>
              
              {/* Opciones cargadas desde la API */}
              {/* Usamos los nombres de columna: id, unidad, simbolo */}
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.unidad} ({unidad.simbolo})
                </option>
              ))}
            </select>
          </div>
          {/* --- FIN SECCIÓN MODIFICADA --- */}


          {/* Nombre (Generado) */}
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
              Nombre (Generado)
            </label>
            <input
              id="nombre"
              name="nombre"
              value={nombreGenerado}
              readOnly
              className={inputStyle}
            />
          </div>

          {/* Activo */}
          <div className="flex items-center mt-6">
            <input
              id="activo"
              name="activo"
              type="checkbox"
              checked={formData.activo}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">
              Activo
            </label>
          </div>
        </div>
      </div>

      {/* --- SECCIÓN DE ACCIONES (sin cambios) --- */}
      <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-4 border-t-2 border-gray-200">
        <button
          type="button"
          onClick={limpiarFormulario}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-500 text-indigo-600 font-semibold uppercase rounded-md shadow-sm hover:bg-indigo-50 transition"
        >
          <CleaningServicesIcon fontSize="small"/>
          Limpiar Formulario
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold uppercase rounded-md shadow-sm hover:bg-indigo-700 transition"
        >
          <AddCircleOutlineIcon />
          Guardar Producto
        </button>
      </div>
    </form>
  );
};

export default AgregarProductoForm;