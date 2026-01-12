import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';

// Configuración de URL (ajustar según tu entorno)
const API_BASE_URL = import.meta.env.VITE_API_URL; // Esta es la URL base del backend

export default function CrearEmpleadoForm({ empleadoAEditar, onClose, onGuardado }) {
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    num_empl: '',
    empleado: '', // Nombre completo
    fecha_ingreso: '',
    rfc: '',
    nss: '',
    curp: '',
    genero: '',
    fecha_nacimiento: '',
    empresa: '',
    puesto: '',
    departamento: '',
    status_laboral: 'Activo' // Valor por defecto
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Efecto para rellenar datos si estamos editando
  useEffect(() => {
    if (empleadoAEditar) {
      // Formateamos las fechas para que el input type="date" las entienda (YYYY-MM-DD)
      const formatearParaInput = (fecha) => {
        if (!fecha) return '';
        return new Date(fecha).toISOString().split('T')[0];
      };

      setFormData({
        ...empleadoAEditar,
        fecha_ingreso: formatearParaInput(empleadoAEditar.fecha_ingreso),
        fecha_nacimiento: formatearParaInput(empleadoAEditar.fecha_nacimiento),
      });
    }
  }, [empleadoAEditar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = empleadoAEditar 
        ? `${API_BASE_URL}/api/empleados/${empleadoAEditar.id}` // PUT
        : `${API_BASE_URL}/api/empleados`; // POST
      
      const method = empleadoAEditar ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Error al guardar la información');
      }

      // Si todo sale bien
      onGuardado(); // Avisamos al padre para que recargue la tabla
      onClose();    // Cerramos el modal

    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al intentar guardar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Encabezado */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {empleadoAEditar ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <CloseIcon />
          </button>
        </div>

        {/* Cuerpo del formulario con Scroll */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* --- SECCIÓN 1: DATOS GENERALES --- */}
            <div className="md:col-span-3 pb-2 border-b border-gray-100 mb-2">
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Datos Personales</h3>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Empleado</label>
              <input 
                type="text" 
                name="num_empl"
                value={formData.num_empl}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Ej: 10045"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                name="empleado"
                value={formData.empleado}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Nacimiento</label>
              <input 
                type="date" 
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
              <select 
                name="genero" 
                value={formData.genero} 
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
              >
                <option value="">Seleccione</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* --- SECCIÓN 2: DATOS FISCALES --- */}
            <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4 mb-2">
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Información Legal</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input 
                type="text" 
                name="rfc"
                value={formData.rfc}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition uppercase"
                placeholder="RFC con Homoclave"
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CURP</label>
              <input 
                type="text" 
                name="curp"
                value={formData.curp}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition uppercase"
                placeholder="CURP"
                maxLength={18}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NSS</label>
              <input 
                type="text" 
                name="nss"
                value={formData.nss}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Número de Seguro Social"
              />
            </div>

            {/* --- SECCIÓN 3: DATOS LABORALES --- */}
            <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4 mb-2">
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Datos Laborales</h3>
            </div>

            <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <select 
                name="empresa" 
                value={formData.empresa} 
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
              >
                <option value="">Seleccione</option>
                <option value="BIOENERGY">BIOENERGY</option>
                <option value="IG BIOGAS">IG BIOGAS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <select 
                name="departamento" 
                value={formData.departamento} 
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
              >
                <option value="">Seleccione</option>
                <option value="BIOENERGY">BIOENERGY</option>
                <option value="ADMINISTRACION">ADMINISTRACION</option>
                <option value="DESARROLLO E INVESTIGACION">DESARROLLO E INVESTIGACION</option>
                <option value="COMERCIALIZACION">COMERCIALIZACION</option>
                <option value="OPERACIONES">OPERACIONES</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
              <select 
                name="puesto" 
                value={formData.puesto} 
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
              >
                <option value="">Seleccione</option>
                <option value="GERENTE">GERENTE</option>
                <option value="JEFE">JEFE</option>
                <option value="STAFF">STAFF</option>
                <option value="COORDINADOR">COORDINADOR</option>
                <option value="VIGILANTE">VIGILANTE</option>
                <option value="AUXILIAR">AUXILIAR</option>
                <option value="AYUDANTE GENERAL">AYUDANTE GENERAL</option>
                <option value="SOLDADOR A">SOLDADOR A</option>
                 <option value="SOLDADOR B">SOLDADOR B</option>
                <option value="INSTALADOR">INSTALADOR</option>
                <option value="INGENIERO">INGENIERO</option>
                <option value="PERSONAL DE LIMPIEZA">PERSONAL DE LIMPIEZA</option>
                <option value="PRACTICANTE">PRACTICANTE</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
              <input 
                type="date" 
                name="fecha_ingreso"
                value={formData.fecha_ingreso}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estatus Laboral</label>
              <select 
                name="status_laboral" 
                value={formData.status_laboral} 
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
              >
                <option value="Seleccione">Seleccione</option>
                <option value="activo">activo</option>
                <option value="inactivo">inactivo</option>
                <option value="vacaciones">vacaciones</option>
                <option value="licencia">licencia</option>
                <option value="baja">baja</option>
              </select>
            </div>

          </form>
        </div>

        {/* Footer con Botones */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Guardando...' : (
              <>
                <SaveIcon fontSize="small" />
                {empleadoAEditar ? 'Actualizar Empleado' : 'Guardar Empleado'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}