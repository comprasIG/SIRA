// src/components/rh/VerEmpleados.jsx
import { useState, useEffect, useMemo } from 'react';

// --- IMPORTACIONES DE ICONOS MATERIAL UI (MUI) ---
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BadgeIcon from '@mui/icons-material/Badge';     // Para RFC/CURP
import WorkIcon from '@mui/icons-material/Work';       // Para Empresa/Puesto
import CakeIcon from '@mui/icons-material/Cake';       // Para Cumpleaños/Edad
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'; // Para Fecha Ingreso
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // Para Antigüedad

// --- LECTURA DE LA VARIABLE DE ENTORNO ---
const API_BASE_URL = import.meta.env.VITE_API_URL; // Esta es la URL base del backend

// Advertencia si la variable no está definida
if (!import.meta.env.VITE_API_URL) {
  console.warn("ADVERTENCIA: VITE_API_URL no está definida en tu archivo .env. Usando http://localhost:3001 como respaldo.");
} 
// Puedes cambiar el valor de respaldo si tu backend corre en otro puerto

// Componente principal
export default function VerEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');

  // Estado para el modal (Tarjeta de empleado)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);

  // --- CARGA DE DATOS REALES ---
  // --- CARGA DE DATOS REALES (MODIFICADO) ---
  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/empleados`);
        
        if (!response.ok) {
          throw new Error('Error al obtener los datos del servidor');
        }

        const data = await response.json();
        
        // --- AQUÍ ESTÁ EL TRUCO ---
        console.log("Datos recibidos del Backend:", data); // Mirar la consola para ver qué llega realmente

        if (Array.isArray(data)) {
          //El backend envió la lista directa
          setEmpleados(data);
        } else if (data.rows && Array.isArray(data.rows)) {
          // El backend envió un objeto de Postgres con una propiedad 'rows'
          setEmpleados(data.rows);
        } else if (data.data && Array.isArray(data.data)) {
           //El backend envió un objeto { data: [...] }
           setEmpleados(data.data);
        } else {
          //  No entendemos qué llegó, ponemos lista vacía para que no explote
          console.error("El formato de datos no es un arreglo:", data);
          setEmpleados([]);
        }

      } catch (err) {
        console.error(err);
        setError('No se pudo conectar con la base de datos.');
        setEmpleados([]); 
      } finally {
        setLoading(false);
      }
    };

    fetchEmpleados();
  }, []);

  // --- LÓGICA DE FILTROS Y KPIS ---

  // Obtener lista única de departamentos
  const departamentos = useMemo(() => {
    // Mapeo usando el campo 'departamento'
    const deps = empleados.map(e => e.departamento).filter(Boolean);
    return [...new Set(deps)];
  }, [empleados]);

  // Filtrar empleados
  const empleadosFiltrados = empleados.filter((emp) => {
    // Búsqueda por 'empleado' (nombre) o 'num_empl'
    const termino = busqueda.toLowerCase();
    const coincideNombre = emp.empleado?.toLowerCase().includes(termino);
    const coincideNum = emp.num_empl?.toString().toLowerCase().includes(termino);
    
    // Filtro por departamento
    const coincideDepto = filtroDepartamento ? emp.departamento === filtroDepartamento : true;
    
    return (coincideNombre || coincideNum) && coincideDepto;
  });

  // KPIs dinámicos
  const kpis = {
    total: empleados.length,
    activos: empleadosFiltrados.length,
    totalDeptos: departamentos.length
  };

  // Función auxiliar para formatear fechas
  const formatearFecha = (fechaString) => {
    if (!fechaString) return 'N/A';
    return new Date(fechaString).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  // Función para calcular la edad exacta
  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return 0;
    
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    // Si el mes actual es menor al mes de nacimiento,
    // o si es el mismo mes pero el día actual es menor al día de nacimiento,
    // significa que todavía no ha cumplido años, así que restamos 1.
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  // Función para calcular antigüedad (Años y Meses)
  const calcularAntiguedad = (fechaIngreso) => {
    if (!fechaIngreso) return 'Sin datos';
    
    const inicio = new Date(fechaIngreso);
    const hoy = new Date();
    
    let anios = hoy.getFullYear() - inicio.getFullYear();
    let meses = hoy.getMonth() - inicio.getMonth();

    // Ajuste si aún no ha pasado el mes/día de aniversario
    if (meses < 0 || (meses === 0 && hoy.getDate() < inicio.getDate())) {
      anios--;
      meses += 12;
    }
    
    // Ajuste fino de meses si el día actual es menor al día de ingreso
    if (hoy.getDate() < inicio.getDate()) {
        meses--;
    }

    // Formateo del texto
    const textoAnios = anios === 1 ? '1 año' : `${anios} años`;
    const textoMeses = meses > 0 ? ` y ${meses} ${meses === 1 ? 'mes' : 'meses'}` : '';
    
    // Caso especial: menos de un mes
    if (anios === 0 && meses === 0) return 'Menos de 1 mes';

    return `${textoAnios}${textoMeses}`;
  };

  // --- RENDERIZADO ---

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      
      {/* TÍTULO */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Directorio de Empleados</h1>
        <p className="text-gray-500 text-sm">Base de datos de personal activa.</p>
      </div>

      {/* --- SECCIÓN DE KPIS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <GroupIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Empleados</p>
            <p className="text-2xl font-bold text-gray-800">{kpis.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
            <BusinessIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Departamentos</p>
            <p className="text-2xl font-bold text-gray-800">{kpis.totalDeptos}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-full">
            <SearchIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Resultados búsqueda</p>
            <p className="text-2xl font-bold text-gray-800">{kpis.activos}</p>
          </div>
        </div>
      </div>

      {/* --- BARRA DE BÚSQUEDA Y FILTROS --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-1/2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <SearchIcon sx={{ fontSize: 18 }} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o número de empleado..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="relative w-full md:w-1/3 flex items-center gap-2">
          <FilterListIcon sx={{ fontSize: 18 }} className="text-gray-400 absolute left-3" />
          <select 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
            value={filtroDepartamento}
            onChange={(e) => setFiltroDepartamento(e.target.value)}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map(dep => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- TABLA DE EMPLEADOS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">No. Empl</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Departamento / Empresa</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Puesto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Detalles</th>
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
                    {/* Nombre y Foto */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 text-gray-400 flex items-center justify-center border border-gray-300 flex-shrink-0">
                           {/* Usamos Icono porque no hay campo de foto en DB */}
                           <AccountCircleIcon sx={{ fontSize: 32 }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                            {emp.empleado}
                          </p>
                          <p className="text-xs text-gray-400">
                             Ingreso: {formatearFecha(emp.fecha_ingreso)}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    {/* Número de Empleado */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {emp.num_empl}
                    </td>

                    {/* Departamento y Empresa */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">{emp.departamento}</span>
                        <span className="text-xs text-gray-400">{emp.empresa}</span>
                      </div>
                    </td>

                    {/* Puesto */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {emp.puesto}
                    </td>

                    {/* Status Laboral */}
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${emp.status_laboral?.toLowerCase().includes('activo') 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'}`}>
                          {emp.status_laboral || 'Desconocido'}
                        </span>
                    </td>

                    {/* Botón */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className="text-blue-600 group-hover:text-blue-900">Ver más &rarr;</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-500 italic">
                    {error ? <span className="text-red-500">{error}</span> : "No se encontraron empleados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL / TARJETA DE DETALLE CON TUS DATOS --- */}
      {empleadoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-fade-in-up">
            
            <button 
              onClick={() => setEmpleadoSeleccionado(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-black/10 rounded-full text-white z-10 transition"
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </button>

            {/* Cabecera */}
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
            <div className="px-8 pb-8">
              <div className="relative -mt-16 mb-6 flex justify-between items-end">
                <div className="h-32 w-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg flex items-center justify-center text-gray-300">
                   <AccountCircleIcon sx={{ fontSize: 110 }} />
                </div>
                <div className="mb-2 text-right">
                   <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide text-white
                      ${empleadoSeleccionado.status_laboral?.toLowerCase().includes('activo') ? 'bg-green-500' : 'bg-red-500'}`}>
                     {empleadoSeleccionado.status_laboral}
                   </span>
                   <p className="text-xs text-gray-400 mt-1">ID: {empleadoSeleccionado.num_empl}</p>
                </div>
              </div>

              {/* Información Principal */}
              <div className="mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-3xl font-bold text-gray-900">{empleadoSeleccionado.empleado}</h2>
                <div className="flex items-center text-blue-700 font-medium mt-1 gap-2">
                    <WorkIcon sx={{ fontSize: 18 }} />
                    {empleadoSeleccionado.puesto}
                </div>
                <div className="flex items-center text-gray-500 text-sm mt-1 gap-2">
                  <BusinessIcon sx={{ fontSize: 18 }} />
                  {empleadoSeleccionado.departamento} en <strong>{empleadoSeleccionado.empresa}</strong>
                </div>
              </div>

              {/* Grid de Detalles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Columna 1: Información Personal */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Información Personal</h3>
                    
                    <div className="flex items-start gap-3">
                        <BadgeIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">CURP</p>
                            <p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.curp || '---'}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <BadgeIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">RFC</p>
                            <p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.rfc || '---'}</p>
                        </div>
                    </div>

                    {/*Fecha de nacimiento y edad automatica*/}
                    <div className="flex items-start gap-3">
                        <CakeIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">Nacimiento / Edad</p>
                            <p className="text-sm font-medium text-gray-800">
                                {/* Aquí llamamos a ambas funciones */}
                                {formatearFecha(empleadoSeleccionado.fecha_nacimiento)} 
                                {' '}
                                <span className="text-blue-600 font-bold">
                                ({calcularEdad(empleadoSeleccionado.fecha_nacimiento)} años)
                                </span>
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{empleadoSeleccionado.genero}</p>
                        </div>
                    </div>
                </div>

                {/* Columna 2: Información Laboral */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Datos Laborales</h3>

                    <div className="flex items-start gap-3">
                        <CalendarTodayIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">Fecha de Ingreso</p>
                            <p className="text-sm font-medium text-gray-800">{formatearFecha(empleadoSeleccionado.fecha_ingreso)}</p>
                        </div>
                    </div>

                    {/* ---ANTIGÜEDAD --- */}
                        <div className="flex items-start gap-3">
                            <AccessTimeIcon className="text-blue-500" /> {/* Ícono azul para resaltar */}
                            <div>
                                <p className="text-xs text-gray-500">Antigüedad en la empresa</p>
                                <p className="text-sm font-bold text-blue-700">
                                    {calcularAntiguedad(empleadoSeleccionado.fecha_ingreso)}
                                </p>
                            </div>
                        </div>

                    <div className="flex items-start gap-3">
                        <BadgeIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">NSS (Seguro Social)</p>
                            <p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.nss || '---'}</p>
                        </div>
                    </div>

                     <div className="flex items-start gap-3">
                        <LocationOnIcon className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">Empresa / Sede</p>
                            <p className="text-sm font-medium text-gray-800">{empleadoSeleccionado.empresa}</p>
                        </div>
                    </div>
                </div>

              </div>
              
              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                <span>Registrado: {new Date(empleadoSeleccionado.created_at).toLocaleDateString()}</span>
                <button 
                  onClick={() => setEmpleadoSeleccionado(null)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  Cerrar Ficha
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}