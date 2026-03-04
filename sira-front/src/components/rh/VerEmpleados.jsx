import { useState, useEffect, useMemo } from 'react';

// --- IMPORTACIONES DE ICONOS MATERIAL UI (MUI) ---
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BadgeIcon from '@mui/icons-material/Badge';
import WorkIcon from '@mui/icons-material/Work';
import CakeIcon from '@mui/icons-material/Cake';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SchoolIcon from '@mui/icons-material/School'; // <-- ICONO AÑADIDO PARA NIVEL ACADÉMICO

// --- CONFIGURACIÓN DE LA URL ---
// En tu entorno de producción local (Vite), descomenta la siguiente línea y borra la URL fija:
const API_BASE_URL = import.meta.env.VITE_API_URL;


// ========================================================================================
// COMPONENTE FORMULARIO DE EMPLEADOS
// ========================================================================================
function CrearEmpleadoForm({ empleadoAEditar, onClose, onGuardado }) {
  const [formData, setFormData] = useState({
    num_empl: '',
    empleado: '', 
    fecha_ingreso: '',
    fecha_reingreso: '',
    rfc: '',
    nss: '',
    curp: '',
    genero: '',
    fecha_nacimiento: '',
    status_laboral: '', 
    empresa_id: '',
    area_id: '',
    puesto_id: '',
    departamento_id: '',
    departamento_rh_id: '',
    status_trabajador_id: '',
    nivel_academico_id: '' // <-- ESTADO AÑADIDO
  });

  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  // <-- CATÁLOGO DE NIVEL ACADÉMICO AÑADIDO
  const [catalogos, setCatalogos] = useState({
    empresas: [], areas: [], puestos: [], departamentos_rh: [], status_trabajadores: [], departamentos: [], nivel_academico: []
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
            departamentos: data.departamentos || [],
            nivel_academico: data.nivel_academico || [] // <-- SET CATÁLOGO
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
        fecha_ingreso: formatearParaInput(empleadoAEditar.fecha_ingreso),
        fecha_reingreso: formatearParaInput(empleadoAEditar.fecha_reingreso),
        rfc: empleadoAEditar.rfc || '',
        nss: empleadoAEditar.nss || '',
        curp: empleadoAEditar.curp || '',
        genero: empleadoAEditar.genero || '',
        fecha_nacimiento: formatearParaInput(empleadoAEditar.fecha_nacimiento),
        status_laboral: empleadoAEditar.status_laboral || '', 
        empresa_id: empleadoAEditar.empresa_id || '',
        area_id: empleadoAEditar.area_id || '',
        puesto_id: empleadoAEditar.puesto_id || '',
        departamento_id: empleadoAEditar.departamento_id || '',
        departamento_rh_id: empleadoAEditar.departamento_rh_id || '',
        status_trabajador_id: empleadoAEditar.status_trabajador_id || '',
        nivel_academico_id: empleadoAEditar.nivel_academico_id || '' // <-- RECUPERAR ID
      });

      // Cargar vista previa si el empleado ya tiene foto
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
                  <option value="NO ESPECIFICADO">No Especificado</option>
                </select>
              </div>

              {/* --- SELECT DE NIVEL ACADÉMICO --- */}
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
                            <AccountCircleIcon className="text-gray-400" />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Depto. Operativo (SIRA)</label>
                <select name="departamento_id" value={formData.departamento_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Depto Operativo</option>
                  {catalogos.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Estatus Laboral (SIRA) <span className="text-red-500">*</span></label>
                <select name="status_laboral" value={formData.status_laboral} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">Selecciona Estatus</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                <input type="date" name="fecha_ingreso" value={formData.fecha_ingreso} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Reingreso <span className="text-xs text-gray-400 font-normal">(Si aplica)</span></label>
                <input type="date" name="fecha_reingreso" value={formData.fecha_reingreso} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
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

// ========================================================================================
// COMPONENTE PRINCIPAL: VER EMPLEADOS
// ========================================================================================
export default function VerEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para filtros actualizados (RH, Área y Estatus)
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepartamentoRH, setFiltroDepartamentoRH] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState(''); 

  // Estado para el modal de Detalles (Tarjeta de empleado)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);

  // Estados para el modal de Crear/Editar
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [empleadoAEditar, setEmpleadoAEditar] = useState(null);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/empleados`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data = await response.json();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con la base de datos.');
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpleados();
  }, []);

  const handleCrearEmpleado = () => {
    setEmpleadoAEditar(null);
    setMostrarFormulario(true);
  };

  const handleEditarEmpleado = (empleado, e) => {
    e.stopPropagation(); 
    setEmpleadoAEditar(empleado);
    setMostrarFormulario(true);
  };

  const handleEliminarEmpleado = async (id, nombre, e) => {
    e.stopPropagation(); 
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`)) {
      try {
        await fetch(`${API_BASE_URL}/api/empleados/${id}`, { method: 'DELETE' });
        setEmpleados(empleados.filter(e => e.id !== id));
        alert("Empleado eliminado correctamente");
      } catch (error) {
        console.error(error);
        alert("Error al eliminar");
      }
    }
  };

  const departamentosRH = useMemo(() => {
    const deps = empleados.map(e => e.nombre_departamento_rh).filter(Boolean);
    return [...new Set(deps)].sort();
  }, [empleados]);

  const areas = useMemo(() => {
    const arr = empleados.map(e => e.nombre_area).filter(Boolean);
    return [...new Set(arr)].sort();
  }, [empleados]);

  const estatusLaborales = useMemo(() => {
    const arr = empleados.map(e => e.status_laboral).filter(Boolean);
    return [...new Set(arr)].sort();
  }, [empleados]);

  const empleadosFiltrados = empleados.filter((emp) => {
    const termino = busqueda.toLowerCase();
    
    const coincideNombre = (emp.empleado || '').toLowerCase().includes(termino);
    const coincideNum = (emp.num_empl || '').toString().toLowerCase().includes(termino);
    
    const coincideDeptoRH = filtroDepartamentoRH ? emp.nombre_departamento_rh === filtroDepartamentoRH : true;
    const coincideArea = filtroArea ? emp.nombre_area === filtroArea : true;
    const coincideEstatus = filtroEstatus ? emp.status_laboral === filtroEstatus : true; 
    
    return (coincideNombre || coincideNum) && coincideDeptoRH && coincideArea && coincideEstatus;
  });

  const kpis = {
    total: empleados.length,
    activos: empleadosFiltrados.length,
    totalDeptos: departamentosRH.length
  };

  const formatearFecha = (fechaString) => {
    if (!fechaString) return 'N/A';
    return new Date(fechaString).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  };

  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) { edad--; }
    return edad;
  };

  const calcularAntiguedad = (fechaIngreso) => {
    if (!fechaIngreso) return 'Sin datos';
    const inicio = new Date(fechaIngreso);
    const hoy = new Date();
    let anios = hoy.getFullYear() - inicio.getFullYear();
    let meses = hoy.getMonth() - inicio.getMonth();
    if (meses < 0 || (meses === 0 && hoy.getDate() < inicio.getDate())) { anios--; meses += 12; }
    if (hoy.getDate() < inicio.getDate()) { meses--; }
    const textoAnios = anios === 1 ? '1 año' : `${anios} años`;
    const textoMeses = meses > 0 ? ` y ${meses} ${meses === 1 ? 'mes' : 'meses'}` : '';
    if (anios === 0 && meses === 0) return 'Menos de 1 mes';
    return `${textoAnios}${textoMeses}`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Directorio de Empleados</h1>
          <p className="text-gray-500 text-sm">Base de datos de personal activa.</p>
        </div>
        <button 
          onClick={handleCrearEmpleado}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
        >
          <AddIcon sx={{ fontSize: 20 }} />
          Nuevo Empleado
        </button>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><GroupIcon sx={{ fontSize: 24 }} /></div>
          <div><p className="text-sm text-gray-500">Total Empleados</p><p className="text-2xl font-bold text-gray-800">{kpis.total}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><BusinessIcon sx={{ fontSize: 24 }} /></div>
          <div><p className="text-sm text-gray-500">Departamentos RH</p><p className="text-2xl font-bold text-gray-800">{kpis.totalDeptos}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-full"><SearchIcon sx={{ fontSize: 24 }} /></div>
          <div><p className="text-sm text-gray-500">Resultados búsqueda</p><p className="text-2xl font-bold text-gray-800">{kpis.activos}</p></div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="relative w-full xl:w-1/4">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><SearchIcon sx={{ fontSize: 18 }} /></span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o ID..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full xl:w-3/4">
          <div className="relative w-full flex items-center gap-2">
            <FilterListIcon sx={{ fontSize: 18 }} className="text-gray-400 absolute left-3" />
            <select 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer text-sm" 
              value={filtroEstatus} 
              onChange={(e) => setFiltroEstatus(e.target.value)}
            >
              <option value="">Todos los Estatus</option>
              {estatusLaborales.map(estatus => (<option key={estatus} value={estatus}>{estatus}</option>))}
            </select>
          </div>

          <div className="relative w-full flex items-center gap-2">
            <FilterListIcon sx={{ fontSize: 18 }} className="text-gray-400 absolute left-3" />
            <select 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer text-sm" 
              value={filtroArea} 
              onChange={(e) => setFiltroArea(e.target.value)}
            >
              <option value="">Todas las Áreas</option>
              {areas.map(area => (<option key={area} value={area}>{area}</option>))}
            </select>
          </div>

          <div className="relative w-full flex items-center gap-2">
            <FilterListIcon sx={{ fontSize: 18 }} className="text-gray-400 absolute left-3" />
            <select 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer text-sm" 
              value={filtroDepartamentoRH} 
              onChange={(e) => setFiltroDepartamentoRH(e.target.value)}
            >
              <option value="">Todos los Deptos RH</option>
              {departamentosRH.map(dep => (<option key={dep} value={dep}>{dep}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* TABLA DE EMPLEADOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Id. Empl</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Depto RH / Área / Empresa</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Puesto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                 <tr><td colSpan="6" className="p-6 text-center text-gray-500">Cargando datos...</td></tr>
              ) : empleadosFiltrados.length > 0 ? (
                empleadosFiltrados.map((emp) => (
                  <tr 
                    key={emp.id} 
                    onClick={() => setEmpleadoSeleccionado(emp)}
                    className="hover:bg-blue-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 text-gray-400 flex items-center justify-center border border-gray-300 flex-shrink-0">
                           {emp.foto_emp ? (
                             <img src={emp.foto_emp.startsWith('http') ? emp.foto_emp : `${API_BASE_URL}/${emp.foto_emp}`} alt="foto" className="h-full w-full object-cover" />
                           ) : (
                             <AccountCircleIcon sx={{ fontSize: 32 }} />
                           )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{emp.empleado}</p>
                          <p className="text-xs text-gray-400">Ingreso: {formatearFecha(emp.fecha_ingreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{emp.num_empl}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700">{emp.nombre_departamento_rh || 'Sin Depto RH'}</span>
                          <span className="text-xs text-gray-500">{emp.nombre_area || 'Sin Área'}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{emp.nombre_empresa || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{emp.nombre_puesto || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${(emp.status_laboral || '').toLowerCase().includes('activo') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {emp.nombre_status || emp.status_laboral || 'Desconocido'}
                        </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEmpleadoSeleccionado(emp); }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Ver Detalle"
                        >
                          <VisibilityIcon sx={{ fontSize: 20 }} />
                        </button>
                        
                        <button 
                          onClick={(e) => handleEditarEmpleado(emp, e)}
                          className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
                          title="Editar"
                        >
                          <EditIcon sx={{ fontSize: 20 }} />
                        </button>

                        <button 
                          onClick={(e) => handleEliminarEmpleado(emp.id, emp.empleado, e)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <DeleteIcon sx={{ fontSize: 20 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500 italic">{error ? <span className="text-red-500">{error}</span> : "No se encontraron empleados."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FORMULARIO CREAR / EDITAR --- */}
      {mostrarFormulario && (
        <CrearEmpleadoForm 
          empleadoAEditar={empleadoAEditar} 
          onClose={() => {
            setMostrarFormulario(false);
            setEmpleadoAEditar(null);
          }} 
          onGuardado={() => {
            setMostrarFormulario(false);
            setEmpleadoAEditar(null);
            fetchEmpleados(); 
          }} 
        />
      )}

      {/* --- MODAL DETALLES --- */}
      {empleadoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-fade-in-up">
            <button onClick={() => setEmpleadoSeleccionado(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-black/10 rounded-full text-white z-10 transition">
              <CloseIcon sx={{ fontSize: 20 }} />
            </button>
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
            <div className="px-8 pb-8">
              <div className="relative -mt-16 mb-6 flex justify-between items-end">
                <div className="h-32 w-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg flex items-center justify-center text-gray-300">
                    {empleadoSeleccionado.foto_emp ? (
                         <img src={empleadoSeleccionado.foto_emp.startsWith('http') ? empleadoSeleccionado.foto_emp : `${API_BASE_URL}/${empleadoSeleccionado.foto_emp}`} alt="foto perfil" className="h-full w-full object-cover" />
                    ) : (
                         <AccountCircleIcon sx={{ fontSize: 110 }} />
                    )}
                </div>
                <div className="mb-2 text-right">
                   <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide text-white ${(empleadoSeleccionado.status_laboral || '').toLowerCase().includes('activo') ? 'bg-green-500' : 'bg-red-500'}`}>
                       {empleadoSeleccionado.nombre_status || empleadoSeleccionado.status_laboral || 'Desconocido'}
                   </span>
                   <p className="text-xs text-gray-400 mt-1">ID: {empleadoSeleccionado.num_empl}</p>
                </div>
              </div>
              <div className="mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-3xl font-bold text-gray-900">{empleadoSeleccionado.empleado}</h2>
                <div className="flex items-center text-blue-700 font-medium mt-1 gap-2"><WorkIcon sx={{ fontSize: 18 }} />{empleadoSeleccionado.nombre_puesto || 'N/A'}</div>
                <div className="flex items-center text-gray-500 text-sm mt-1 gap-2">
                    <BusinessIcon sx={{ fontSize: 18 }} />
                    {empleadoSeleccionado.nombre_departamento_rh || 'N/A'} en <strong>{empleadoSeleccionado.nombre_empresa || 'N/A'}</strong>
                </div>
                {empleadoSeleccionado.nombre_area && (
                    <div className="flex items-center text-gray-500 text-sm mt-1 gap-2">
                        <AssignmentIndIcon sx={{ fontSize: 18 }} /> Área: {empleadoSeleccionado.nombre_area}
                    </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Información Personal</h3>
                    <div className="flex items-start gap-3"><BadgeIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">CURP</p><p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.curp || '---'}</p></div></div>
                    <div className="flex items-start gap-3"><BadgeIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">RFC</p><p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.rfc || '---'}</p></div></div>
                    <div className="flex items-start gap-3"><CakeIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">Nacimiento / Edad</p><p className="text-sm font-medium text-gray-800">{formatearFecha(empleadoSeleccionado.fecha_nacimiento)} <span className="text-blue-600 font-bold">({calcularEdad(empleadoSeleccionado.fecha_nacimiento)} años)</span></p><p className="text-xs text-gray-400 capitalize">{empleadoSeleccionado.genero}</p></div></div>
                    {/* --- NUEVO: NIVEL ACADÉMICO --- */}
                    <div className="flex items-start gap-3"><SchoolIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">Nivel Académico</p><p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.nombre_nivel_academico || '---'}</p></div></div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Datos Laborales</h3>
                    <div className="flex items-start gap-3"><CalendarTodayIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">Fecha de Ingreso</p><p className="text-sm font-medium text-gray-800">{formatearFecha(empleadoSeleccionado.fecha_ingreso)}</p></div></div>
                    {empleadoSeleccionado.fecha_reingreso && (
                        <div className="flex items-start gap-3"><CalendarTodayIcon className="text-orange-400" /><div><p className="text-xs text-orange-500">Fecha de Reingreso</p><p className="text-sm font-medium text-gray-800">{formatearFecha(empleadoSeleccionado.fecha_reingreso)}</p></div></div>
                    )}
                    <div className="flex items-start gap-3"><AccessTimeIcon className="text-blue-500" /><div><p className="text-xs text-gray-500">Antigüedad</p><p className="text-sm font-bold text-blue-700">{calcularAntiguedad(empleadoSeleccionado.fecha_ingreso)}</p></div></div>
                    <div className="flex items-start gap-3"><BadgeIcon className="text-gray-400" /><div><p className="text-xs text-gray-500">NSS</p><p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.nss || '---'}</p></div></div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                <span>Registrado: {new Date(empleadoSeleccionado.created_at).toLocaleDateString()}</span>
                <button onClick={() => setEmpleadoSeleccionado(null)} className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cerrar Ficha</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}