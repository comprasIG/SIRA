//D:\SIRA\SIRA\sira-front\src\components\AgregarProductoForm.jsx

import { useState } from "react";
import axios from "axios";
import { useEffect } from "react";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import { toast } from "react-toastify";


const inputStyle =
  "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";

const AgregarProductoForm = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "",
    categoria: "",
    detalle: "",
    sku: "",
    unidad_de_compra: "",
    ultimo_precio: "",
    activo: true,
  });

  //Es la const para que todo lo que se escribe solo sea en mayusculas
  const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  let parsedValue;

  if (name === "unidad_de_compra") {
    parsedValue = parseInt(value, 10);
  } else if (type === "checkbox") {
    parsedValue = checked;
  } else {
    parsedValue = value.toUpperCase(); // 👈 convierte a mayúsculas
  }

  setFormData({
    ...formData,
    [name]: parsedValue,
  });
};

  
  useEffect(() => {
  const { tipo, categoria, detalle } = formData;
  const partes = [tipo, categoria, detalle].filter(Boolean);
  const nombreGenerado = partes.join(" ");
  setFormData((prev) => ({
    ...prev,
    nombre: nombreGenerado,
  }));
}, [formData.tipo, formData.categoria, formData.detalle]);


  const handleSubmit = async (e) => {
  e.preventDefault();
  try {
   const payload = { ...formData };
delete payload.nombre;

    await axios.post("http://localhost:3001/api/catalogo_materiales", payload);
    toast.success("Producto agregado correctamente");
    setFormData({
      tipo: "",
      categoria: "",
      detalle: "",
      sku: "",
      unidad_de_compra: "",
      ultimo_precio: "",
      activo: true,
      nombre: "", // se puede regenerar automáticamente
    });
  } catch (error) {
    console.error("Error al agregar producto:", error);
    toast.error("Hubo un error al guardar el producto");
  }
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
            <option value="">Selecciona una unidad...</option>
            <option value="1">Pieza (PZ)</option>
            <option value="2">Kilogramo (KG)</option>
            <option value="3">Litro (L)</option>
            <option value="4">Galon (GAL)</option>
            <option value="5">Kit (KIT)</option>
            <option value="6">Metro (M)</option>
            <option value="7">Centimetro (CM)</option>
            <option value="6">Milimetro (MM)</option>
            <option value="6">Pulgada (IN)</option>
            <option value="6">T (T)</option>
            <option value="6">Par (PAR)</option>
            <option value="6">Tramo (TM)</option>
        </select>
        </div>

           <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700" >
              Nombre
            </label>
            <input
            id="nombre"
            name="nombre"
            value={formData.nombre}
            readOnly
            className={inputStyle}
            />
          </div>

          {/*}
          <div>
            <label htmlFor="ultimo_precio" className="block text-sm font-medium text-gray-700">
              Último precio
            </label>
            <input
              id="ultimo_precio"
              name="ultimo_precio"
              value={formData.ultimo_precio}
              onChange={handleChange}
              className={inputStyle}
            />
          </div>
          {*/}

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

      {/* --- SECCIÓN DE ACCIONES --- */}
      <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-4 border-t-2 border-gray-200">
        <button
          type="button"
          onClick={() =>
            setFormData({
              tipo: "",
              categoria: "",
              detalle: "",
              sku: "",
              unidad_de_compra: "",
              activo: true,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-500 text-indigo-600 font-semibold uppercase rounded-md shadow-sm hover:bg-indigo-50 transition"
        >
          {/*Es el icono para el boton borrar*/}
          <CleaningServicesIcon fontSize="small"/>
          Limpiar Formulario
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold uppercase rounded-md shadow-sm hover:bg-indigo-700 transition"
        >
          {/*Es el icono para el boton Guardar*/}
          <AddCircleOutlineIcon />
          Guardar Producto
        </button>
      </div>
    </form>
  );
};

export default AgregarProductoForm;