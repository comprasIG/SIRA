//D:\SIRA\SIRA\sira-front\src\components\AgregarProductoForm.jsx
// --- MODIFICADO --- Se añaden 'useState' y 'useEffect'
import { useState, useEffect } from "react";
import axios from "axios";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import StyleIcon from '@mui/icons-material/Style';
import DescriptionIcon from '@mui/icons-material/Description';
import ScaleIcon from '@mui/icons-material/Scale';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { toast } from "react-toastify";

// --- LECTURA DE LA VARIABLE DE ENTORNO ---
const API_BASE_URL = import.meta.env.VITE_API_URL; 

if (!import.meta.env.VITE_API_URL) {
  console.warn("ADVERTENCIA: VITE_API_URL no está definida en tu archivo .env. Usando http://localhost:3001 como respaldo.");
}

// --- ESTILOS MEJORADOS CON COLORES SUAVIZADOS ---
const inputStyle =
  "mt-2 block w-full border border-gray-200 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 sm:text-sm transition-all duration-300 read-only:bg-gray-50 read-only:border-gray-300 read-only:text-gray-600";

const labelStyle = "block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2";

// --- ESTADO INICIAL ---
const initialState = {
  tipo: "",
  categoria: "",
  detalle: "",
  sku: "",
  unidad_de_compra: "",
  activo: true,
};

const AgregarProductoForm = () => {
  const [formData, setFormData] = useState(initialState);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);

  // --- useEffect para cargar las unidades ---
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        setCargandoUnidades(true);
        const url = `${API_BASE_URL}/api/catalogo_unidades`;
        const respuesta = await axios.get(url);
        setUnidades(respuesta.data);
      } catch (error) {
        console.error("Error al cargar unidades:", error);
        toast.error("Error: No se pudieron cargar las unidades de medida.");
      } finally {
        setCargandoUnidades(false);
      }
    };

    cargarUnidades();
  }, []);

  // --- Generación de nombre ---
  const nombreGenerado = [formData.tipo, formData.categoria, formData.detalle]
    .filter(Boolean)
    .join(" ");

  // --- HandleChange ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let parsedValue;

    if (type === "checkbox") {
      parsedValue = checked;
    } else {
      parsedValue = (name === 'unidad_de_compra') ? value : value.toUpperCase();
    }
    
    setFormData({
      ...formData,
      [name]: parsedValue,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        nombre: nombreGenerado,
        ultimo_precio: 0,
        unidad_de_compra: parseInt(formData.unidad_de_compra, 10)
      };

      const url = `${API_BASE_URL}/api/catalogo_materiales`;
      await axios.post(url, payload);

      toast.success("✅ Producto agregado correctamente");
      setFormData(initialState);

    } catch (error) {
      console.error("Error al agregar producto:", error);
      if (error.code === "ERR_NETWORK") {
        toast.error(`❌ Error de Red: No se pudo conectar a ${API_BASE_URL}.`);
      } else if (error.response) {
        const message = error.response.data?.message || "Error del servidor.";
        toast.error(`❌ Error ${error.response.status}: ${message}`);
      } else {
        toast.error("❌ Hubo un error al guardar. Revisa la consola.");
      }
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setFormData(initialState);
    toast.info("🧹 Formulario limpiado");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen"
      autoComplete="off"
    >

      {/* --- SECCIÓN DE DATOS DEL PRODUCTO --- */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AutoAwesomeIcon className="text-blue-600 text-xl" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            Información del Producto
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tipo */}
          <div className="space-y-1">
            <label htmlFor="tipo" className={labelStyle}>
              <CategoryIcon fontSize="small" className="text-blue-500" />
              Tipo de Producto
            </label>
            <input
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="Ej: CODO, TUBO, VALVULA"
            />
            <p className="text-xs text-gray-500 mt-1">Clasificación principal del producto</p>
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <label htmlFor="categoria" className={labelStyle}>
              <StyleIcon fontSize="small" className="text-indigo-500" />
              Categoría
            </label>
            <input
              id="categoria"
              name="categoria"
              value={formData.categoria}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="Ej: INOX SOLD. T304, PVC, COBRE"
            />
            <p className="text-xs text-gray-500 mt-1">Especificación o material</p>
          </div>

          {/* Detalle */}
          <div className="space-y-1">
            <label htmlFor="detalle" className={labelStyle}>
              <DescriptionIcon fontSize="small" className="text-teal-500" />
              Detalle Técnico
            </label>
            <input
              id="detalle"
              name="detalle"
              value={formData.detalle}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="Ej: 4 x 90°, 1/2 PULG, 100MM"
            />
            <p className="text-xs text-gray-500 mt-1">Medidas o especificaciones técnicas</p>
          </div>

          {/* SKU */}
          <div className="space-y-1">
            <label htmlFor="sku" className={labelStyle}>
              <InventoryIcon fontSize="small" className="text-amber-500" />
              Código SKU
            </label>
            <input
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              required
              className={inputStyle}
              placeholder="Ej: AC.CS05, VL.INOX.304"
            />
            <p className="text-xs text-gray-500 mt-1">Código único de identificación</p>
          </div>

          {/* Unidad de Medida */}
          <div className="space-y-1">
            <label htmlFor="unidad_de_compra" className={labelStyle}>
              <ScaleIcon fontSize="small" className="text-amber-500" />
              Unidad de Medida
            </label>
            <select
              id="unidad_de_compra"
              name="unidad_de_compra"
              value={formData.unidad_de_compra}
              onChange={handleChange}
              required
              disabled={cargandoUnidades}
              className={`${inputStyle} ${cargandoUnidades ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">
                {cargandoUnidades ? "Cargando unidades..." : "Selecciona una unidad..."}
              </option>
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.unidad} ({unidad.simbolo})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Unidad para compra y almacenamiento</p>
          </div>

          {/* Nombre Generado */}
          <div className="space-y-1">
            <label htmlFor="nombre" className={labelStyle}>
              <AutoAwesomeIcon fontSize="small" className="text-blue-500" />
              Nombre Generado Automáticamente
            </label>
            <input
              id="nombre"
              name="nombre"
              value={nombreGenerado}
              readOnly
              className={inputStyle}
            />
            <p className="text-xs text-gray-500 mt-1">
              {nombreGenerado ? "✅ Nombre completo generado" : "⚠️ Completa los campos anteriores"}
            </p>
          </div>

          {/* Estado Activo */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <ToggleOnIcon 
                className={`text-2xl ${formData.activo ? 'text-blue-500' : 'text-gray-400'}`}
              />
              <span className={labelStyle}>Estado del Producto</span>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="activo" className="relative inline-flex items-center cursor-pointer">
                <input
                  id="activo"
                  name="activo"
                  type="checkbox"
                  checked={formData.activo}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
              <span className={`text-sm font-medium ${formData.activo ? 'text-green-600' : 'text-gray-600'}`}>
                {formData.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- PREVIEW DEL PRODUCTO --- */}
      {nombreGenerado && (
        <div className="bg-blue-50 p-6 rounded-xl shadow-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <AutoAwesomeIcon className="text-blue-500" />
            <h3 className="text-lg font-semibold text-blue-700">Vista Previa del Producto</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <span className="font-semibold">Nombre:</span> {nombreGenerado}
            </div>
            <div>
              <span className="font-semibold">SKU:</span> {formData.sku || "Pendiente"}
            </div>
            <div>
              <span className="font-semibold">Unidad:</span> {
                unidades.find(u => u.id === parseInt(formData.unidad_de_compra))?.unidad || "Pendiente"
              }
            </div>
            <div>
              <span className="font-semibold">Estado:</span> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs ${formData.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {formData.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- SECCIÓN DE ACCIONES MEJORADA --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              {Object.values(formData).some(value => value !== initialState[Object.keys(initialState)[0]]) 
                ? "📝 Tienes cambios sin guardar" 
                : "💡 Completa el formulario para agregar un nuevo producto"
              }
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 min-w-[150px] justify-center"
            >
              <CleaningServicesIcon fontSize="small"/>
              Limpiar Todo
            </button>
            <button
              type="submit"
              disabled={loading || !nombreGenerado}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 min-w-[150px] justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <AddCircleOutlineIcon />
                  Guardar Producto
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default AgregarProductoForm;