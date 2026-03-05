import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// --- CONFIGURACIÓN DE LA URL ---
// En tu entorno de producción local (Vite), ajusta esto según sea necesario
const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function CrearEmpleadoForm({ empleadoAEditar, onClose, onGuardado }) {
  const [formData, setFormData] = useState({
    num_empl: '',
    empleado: '', 
    fecha_ingreso: '',
    rfc: '',
    nss: '',
    curp: '',
    genero: '',
    fecha_nacimiento: '',
    status_laboral: '', 
    empresa_id: '',
    area_id: '',
    puesto_id: '',
    departamento_rh_id: '',
    status_trabajador_id: '',
    nivel_academico_id: '', 
    // NUEVOS CAMPOS PARA EL CONTROL DE BAJAS
    fecha_baja: '',
    motivo_baja: ''
  });

  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  const [catalogos, setCatalogos] = useState({
    empresas: [], areas: [], puestos: [], departamentos_rh: [], status_trabajadores: [], nivel_academico: []
  });
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        setLoadingCatalogos(true);
        const res = await fetch(`${API_BASE_URL}/api/catalogos`);
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Código ${res.status}: ${errorText}`);
        }
        
        const data = await res.json();
        setCatalogos({
            empresas: data.empresas || [],
            areas: data.areas || [],
            puestos: data.puestos || [],
            departamentos_rh: data.departamentos_rh || [],
            status_trabajadores: data.status_trabajadores || [],
            nivel_academico: data.nivel_academico || [] 
        });
      } catch (err) {
        console.error("Error detallado al cargar catálogos:", err);
        setError(`Error de conexión con catálogos: ${err.message}`);
      } finally {
        setLoadingCatalogos(false);
      }
    };
    fetchCatalogos();
  }, []);

  useEffect(() => {
    if (empleadoAEditar && !loadingCatalogos) {
      const formatearParaInput = (fecha) => {
        if (!fecha) return '';
        return new Date(fecha).toISOString().split('T')[0];
      };

      setFormData({
        num_empl: empleadoAEditar.num_empl || '',
        empleado: empleadoAEditar.empleado || '',
        // Si estamos editando, asumimos que la fecha de ingreso es la del periodo actual
        fecha_ingreso: formatearParaInput(empleadoAEditar.fecha_ingreso), 
        // fecha_reingreso: formatearParaInput(empleadoAEditar.fecha_reingreso), <-- ¡BÓRRALO!
        rfc: empleadoAEditar.rfc || '',
        nss: empleadoAEditar.nss || '',
        curp: empleadoAEditar.curp || '',
        genero: empleadoAEditar.genero || '',
        fecha_nacimiento: formatearParaInput(empleadoAEditar.fecha_nacimiento),
        // IMPORTANTE: Asegúrate de que tu backend mande estos datos al buscar el empleado
        status_laboral: (empleadoAEditar.status_laboral || '').toLowerCase(), 
        empresa_id: empleadoAEditar.empresa_id || '',
        area_id: empleadoAEditar.area_id || '',
        puesto_id: empleadoAEditar.puesto_id || '',
        departamento_rh_id: empleadoAEditar.departamento_rh_id || '',
        status_trabajador_id: empleadoAEditar.status_trabajador_id || '',
        nivel_academico_id: empleadoAEditar.nivel_academico_id || '',
        // INICIALIZAMOS VACÍOS POR SI LO VAN A DAR DE BAJA
        fecha_baja: '',
        motivo_baja: '' 
      });

      if (empleadoAEditar.foto_emp) {
        setFotoPreview(empleadoAEditar.foto_emp.startsWith('http') ? empleadoAEditar.foto_emp : `${API_BASE_URL}/${empleadoAEditar.foto_emp}`);
      } else {
        setFotoPreview(null);
      }
    } else if (!empleadoAEditar) {
      setFotoPreview(null);
      setFotoArchivo(null);
    }
  }, [empleadoAEditar, loadingCatalogos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoArchivo(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = empleadoAEditar 
        ? `${API_BASE_URL}/api/empleados/${empleadoAEditar.id}` 
        : `${API_BASE_URL}/api/empleados`;
      
      const method = empleadoAEditar ? 'PUT' : 'POST';

      const payload = new FormData();
      
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '') {
            payload.append(key, formData[key]);
        }
      });

      if (fotoArchivo) {
        payload.append('foto_emp', fotoArchivo);
      }

      const response = await fetch(url, {
        method: method,
        body: payload
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar la información');
      }

      onGuardado(); 
      onClose();    

    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al intentar guardar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {empleadoAEditar ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {loadingCatalogos ? (
             <div className="flex flex-col justify-center items-center py-10 text-gray-500">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                 <p>Cargando catálogos del sistema...</p>
             </div>
          ) : (
            <form id="empleado-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-3 pb-2 border-b border-gray-100 mb-2">
                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Datos Personales</h3>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Id. Empleado <span className="text-red-500">*</span></label>
                <input type="text" name="num_empl" value={formData.num_empl} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Ej: 10045" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                <input type="text" name="empleado" value={formData.empleado} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Nacimiento</label>
                <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select name="genero" value={formData.genero} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white">
                  <option value="">Seleccione</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Académico</label>
                <select name="nivel_academico_id" value={formData.nivel_academico_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white">
                  <option value="">Selecciona Nivel</option>
                  {catalogos.nivel_academico.map(na => <option key={na.id} value={na.id}>{na.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fotografía del Empleado</label>
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full border border-gray-300 bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {fotoPreview ? (
                            <img src={fotoPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                            <div className="text-gray-400">👤</div>
                        )}
                    </div>
                    <label className="flex-1 flex flex-col items-center justify-center px-3 py-2 bg-white text-blue-600 rounded-lg border border-blue-200 border-dashed cursor-pointer hover:bg-blue-50 transition">
                        <span className="flex items-center gap-2 text-xs font-medium">
                            <CloudUploadIcon fontSize="small"/> {fotoArchivo ? 'Cambiar Imagen' : 'Subir Imagen'}
                        </span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                </div>
              </div>

              <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4 mb-2">
                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Información Legal</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                <input type="text" name="rfc" value={formData.rfc} onChange={handleChange} maxLength={13} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition uppercase" placeholder="Con Homoclave" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CURP</label>
                <input type="text" name="curp" value={formData.curp} onChange={handleChange} maxLength={18} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition uppercase" placeholder="18 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NSS</label>
                <input type="text" name="nss" value={formData.nss} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Seguro Social" />
              </div>

              <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4 mb-2">
                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Datos Laborales e Ingreso</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa <span className="text-red-500">*</span></label>
                <select name="empresa_id" value={formData.empresa_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Empresa</option>
                  {catalogos.empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social || e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área <span className="text-red-500">*</span></label>
                <select name="area_id" value={formData.area_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Área</option>
                  {catalogos.areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area || a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Puesto <span className="text-red-500">*</span></label>
                <select name="puesto_id" value={formData.puesto_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Puesto</option>
                  {catalogos.puestos.map(p => <option key={p.id} value={p.id}>{p.nombre_puesto || p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depto. Recursos Humanos</label>
                <select name="departamento_rh_id" value={formData.departamento_rh_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Depto RH</option>
                  {catalogos.departamentos_rh.map(drh => <option key={drh.id} value={drh.id}>{drh.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catálogo Estatus Trab. <span className="text-red-500">*</span></label>
                <select name="status_trabajador_id" value={formData.status_trabajador_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Estatus</option>
                  {catalogos.status_trabajadores.map(st => <option key={st.id} value={st.id}>{st.nombre_status || st.nombre}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estatus General <span className="text-red-500">*</span></label>
                <select name="status_laboral" value={formData.status_laboral} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
                  <option value="">Selecciona Estatus</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo (Permiso/Incapacidad)</option>
                  <option value="baja">Baja Definitiva</option>
                </select>
              </div>

              {/* Lógica Condicional: Si seleccionan "Baja", mostramos estos campos */}
              {formData.status_laboral === 'baja' && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-red-600 mb-1">Motivo de la Baja <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="motivo_baja" 
                      value={formData.motivo_baja} 
                      onChange={handleChange} 
                      required={formData.status_laboral === 'baja'} 
                      className="w-full px-3 py-2 border border-red-300 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" 
                      placeholder="Ej: Renuncia voluntaria, Fin de contrato..." 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-red-600 mb-1">Fecha de Baja <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      name="fecha_baja" 
                      value={formData.fecha_baja} 
                      onChange={handleChange} 
                      required={formData.status_laboral === 'baja'} 
                      className="w-full px-3 py-2 border border-red-300 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" 
                    />
                  </div>
                </>
              )}

              {/* Ajustamos el título del campo fecha_ingreso */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Ingreso / Movimiento
                </label>
                <input 
                  type="date" 
                  name="fecha_ingreso" 
                  value={formData.fecha_ingreso} 
                  onChange={handleChange} 
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso Original</label>
                <input type="date" name="fecha_ingreso" value={formData.fecha_ingreso} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
              </div>
            </form>
          )}
        </div>
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button type="submit" form="empleado-form" disabled={loading || loadingCatalogos} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            {loading ? 'Guardando...' : (<><SaveIcon fontSize="small" />{empleadoAEditar ? 'Actualizar' : 'Guardar'}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}