import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SaveAsOutlinedIcon from '@mui/icons-material/SaveAsOutlined';
import EditIcon from '@mui/icons-material/Edit';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CategoryIcon from '@mui/icons-material/Category';
import StyleIcon from '@mui/icons-material/Style';
import DescriptionIcon from '@mui/icons-material/Description';
import ScaleIcon from '@mui/icons-material/Scale';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';

// Usamos la variable de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Estilos mejorados con colores suavizados
const inputStyle = "mt-2 block w-full border border-gray-200 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 sm:text-sm transition-all duration-300";
const labelStyle = "block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2";

const EditarProductoModal = ({ producto, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({ ...producto });
  const [listaUnidades, setListaUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);
  const [cambiosRealizados, setCambiosRealizados] = useState(false);

  // Efecto para actualizar el nombre compuesto automáticamente
  useEffect(() => {
    const { tipo, categoria, detalle } = formData;
    const nombreGenerado = [tipo, categoria, detalle].filter(Boolean).join(" ");
    setFormData((prev) => ({ ...prev, nombre: nombreGenerado }));
  }, [formData.tipo, formData.categoria, formData.detalle]);

  // Detectar cambios en el formulario
  useEffect(() => {
    const hayCambios = JSON.stringify(formData) !== JSON.stringify({ ...producto, nombre: [producto.tipo, producto.categoria, producto.detalle].filter(Boolean).join(" ") });
    setCambiosRealizados(hayCambios);
  }, [formData, producto]);

  // Efecto para cargar las unidades desde la API al abrir el modal
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        setCargandoUnidades(true);
        const url = `${API_BASE_URL}/api/catalogo_unidades`;
        const respuesta = await axios.get(url);
        setListaUnidades(respuesta.data);
      } catch (error) {
        console.error("Error al cargar unidades en el modal:", error);
        toast.error("❌ No se pudieron cargar las unidades de medida.");
      } finally {
        setCargandoUnidades(false);
      }
    };
    cargarUnidades();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let valorFinal;
    if (type === "checkbox") {
      valorFinal = checked;
    } else {
      valorFinal = value;
    }

    setFormData({
      ...formData,
      [name]: valorFinal,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        unidad_de_compra: parseInt(formData.unidad_de_compra, 10)
      };

      const url = `${API_BASE_URL}/api/catalogo_materiales/${producto.id}`;
      await axios.put(url, payload);
      
      toast.success("✅ Producto actualizado correctamente");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      if (error.response) {
        toast.error(`❌ Error ${error.response.status}: ${error.response.data?.message || 'Error del servidor'}`);
      } else {
        toast.error("❌ Error de conexión al actualizar el producto");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (cambiosRealizados) {
      if (confirm("⚠️ Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200">
        
        {/* Header Mejorado con colores suavizados */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EditIcon className="text-blue-600 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Editar Producto</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Modificando: <span className="font-semibold text-gray-800">{producto.nombre}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-500 hover:text-gray-700"
            >
              <CancelOutlinedIcon />
            </button>
          </div>
        </div>

        {/* Contenido del Formulario */}
        <form onSubmit={handleSubmit} className="max-h-[60vh] overflow-y-auto p-6 bg-gray-50/50">
          <div className="space-y-4">
            {/* Tipo */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="tipo" className={labelStyle}>
                <CategoryIcon fontSize="small" className="text-blue-500" />
                Tipo de Producto
              </label>
              <input 
                id="tipo" 
                name="tipo" 
                value={formData.tipo} 
                onChange={handleChange} 
                className={inputStyle}
                placeholder="Ej: CODO, TUBO, VALVULA"
              />
            </div>

            {/* Categoría */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="categoria" className={labelStyle}>
                <StyleIcon fontSize="small" className="text-indigo-500" />
                Categoría
              </label>
              <input 
                id="categoria" 
                name="categoria" 
                value={formData.categoria} 
                onChange={handleChange} 
                className={inputStyle}
                placeholder="Ej: INOX SOLD. T304, PVC, COBRE"
              />
            </div>

            {/* Detalle */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="detalle" className={labelStyle}>
                <DescriptionIcon fontSize="small" className="text-teal-500" />
                Detalle Técnico
              </label>
              <input 
                id="detalle" 
                name="detalle" 
                value={formData.detalle} 
                onChange={handleChange} 
                className={inputStyle}
                placeholder="Ej: 4 x 90°, 1/2 PULG, 100MM"
              />
            </div>

            {/* Unidad de Compra */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="unidad_de_compra" className={labelStyle}>
                <ScaleIcon fontSize="small" className="text-amber-500" />
                Unidad de Compra
              </label>
              <select 
                id="unidad_de_compra" 
                name="unidad_de_compra" 
                value={formData.unidad_de_compra} 
                onChange={handleChange} 
                disabled={cargandoUnidades}
                className={`${inputStyle} ${cargandoUnidades ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">
                  {cargandoUnidades ? "Cargando unidades..." : "Selecciona una unidad..."}
                </option>
                {listaUnidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unidad} ({u.simbolo})
                  </option>
                ))}
              </select>
            </div>

            {/* Estado Activo */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <label className={labelStyle}>
                  <ToggleOnIcon fontSize="small" className="text-gray-500" />
                  Estado del Producto
                </label>
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

            {/* Vista Previa del Nombre */}
            {formData.nombre && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <AutoAwesomeIcon fontSize="small" className="text-blue-500" />
                  <span className="text-sm font-semibold text-blue-700">Vista Previa del Nombre:</span>
                </div>
                <p className="text-base font-medium text-gray-800 bg-white p-3 rounded border border-blue-100">
                  {formData.nombre}
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Footer con Botones */}
        <div className="bg-white border-t border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              {cambiosRealizados && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  Tienes cambios sin guardar
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button 
                type="button" 
                onClick={handleClose}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 w-full sm:w-auto justify-center min-w-[130px]"
              >
                <CancelOutlinedIcon fontSize="small" />
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading || !cambiosRealizados}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 w-full sm:w-auto justify-center min-w-[130px]"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <SaveAsOutlinedIcon fontSize="small" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditarProductoModal;