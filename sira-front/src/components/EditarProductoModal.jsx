import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SaveAsOutlinedIcon from '@mui/icons-material/SaveAsOutlined';

// Usamos la variable de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL;

const inputStyle =
  "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";

const EditarProductoModal = ({ producto, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({ ...producto });
  const [listaUnidades, setListaUnidades] = useState([]);

  // Efecto para actualizar el nombre compuesto automáticamente
  useEffect(() => {
    const { tipo, categoria, detalle } = formData;
    const nombreGenerado = [tipo, categoria, detalle].filter(Boolean).join(" ");
    setFormData((prev) => ({ ...prev, nombre: nombreGenerado }));
  }, [formData.tipo, formData.categoria, formData.detalle]);

  // Efecto para cargar las unidades desde la API al abrir el modal
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        // Asegúrate de que la ruta incluya /api si tu backend lo requiere
        const url = `${API_BASE_URL}/api/catalogo_unidades`;
        const respuesta = await axios.get(url);
        setListaUnidades(respuesta.data);
      } catch (error) {
        console.error("Error al cargar unidades en el modal:", error);
        toast.error("No se pudieron cargar las unidades.");
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
    try {
      // Preparamos el payload
      const payload = {
        ...formData,
        // Convertimos la unidad a número antes de enviar
        unidad_de_compra: parseInt(formData.unidad_de_compra, 10)
      };

      // Usamos la URL correcta
      const url = `${API_BASE_URL}/api/catalogo_materiales/${producto.id}`;
      
      await axios.put(url, payload);
      
      onUpdate(); // Recarga la tabla principal
      onClose();  // Cierra el modal
      toast.success("Producto actualizado correctamente");
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      toast.error("Hubo un error al guardar el producto");
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl relative animate-fadeIn">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
        >
          &times;
        </button>

        <div className="flex items-center gap-2 mb-6">
          <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path fillRule="evenodd" d="M2 16a2 2 0 002 2h12a2 2 0 002-2v-5h-2v5H4v-5H2v5z" clipRule="evenodd" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">Editar Producto</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">Tipo</label>
            <input id="tipo" name="tipo" value={formData.tipo} onChange={handleChange} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">Categoría</label>
            <input id="categoria" name="categoria" value={formData.categoria} onChange={handleChange} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="detalle" className="block text-sm font-medium text-gray-700">Detalle</label>
            <input id="detalle" name="detalle" value={formData.detalle} onChange={handleChange} className={inputStyle} />
          </div>
          
          {/* Select de Unidad Dinámico */}
          <div>
            <label htmlFor="unidad_de_compra" className="block text-sm font-medium text-gray-700">Unidad de compra</label>
            <select 
              id="unidad_de_compra" 
              name="unidad_de_compra" 
              value={formData.unidad_de_compra} 
              onChange={handleChange} 
              className={inputStyle}
            >
              <option value="">Selecciona una unidad...</option>
              {listaUnidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unidad} ({u.simbolo})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <input id="activo" name="activo" type="checkbox" checked={formData.activo} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
            {/* AQUÍ ESTABA EL ERROR ANTES: </Slabel> corregido a </label> */}
            <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">Activo</label>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex items-center gap-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition">
              <CancelOutlinedIcon fontSize="small"/> Cancelar
            </button>
            <button type="submit" className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
              <SaveAsOutlinedIcon fontSize="small"/> Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarProductoModal;