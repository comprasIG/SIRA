import React, { useState, useEffect } from 'react';

// --- ICONOS MUI ---
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import SickIcon from '@mui/icons-material/Sick';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';

import SolicitarVacacionesModal from '../SolicitarVacacionesModal';

const API_BASE_URL = import.meta.env.VITE_API_URL; 

export default function PermisosRHTab() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoBuscado, setEmpleadoBuscado] = useState('');
  
  // Estado inicializado vacío, se llenará con la base de datos
  const [solicitudes, setSolicitudes] = useState([]);
  
  const [modalVacacionesAbierto, setModalVacacionesAbierto] = useState(false);
  const [empleadoParaVacaciones, setEmpleadoParaVacaciones] = useState(null);

  // Funciones para cargar datos desde el backend
  const fetchEmpleados = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/empleados`);
      if (!response.ok) throw new Error('Error al obtener empleados');
      const data = await response.json();
      setEmpleados(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error cargando empleados:", error);
    }
  };

  const fetchHistorial = async () => {
    try {
      // Llama a la nueva ruta que creaste en el backend
      const response = await fetch(`${API_BASE_URL}/api/vacaciones/historial`);
      if (!response.ok) throw new Error('Error al obtener historial');
      const data = await response.json();
      setSolicitudes(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error cargando historial de solicitudes:", error);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchEmpleados();
    fetchHistorial();
  }, []);

  const handleAbrirVacaciones = () => {
    const emp = empleados.find(e => e.id.toString() === empleadoBuscado.toString());
    if (emp) {
        setEmpleadoParaVacaciones(emp);
        setModalVacacionesAbierto(true);
    } else {
        alert("Por favor, selecciona un empleado primero.");
    }
  };

  const recargarHistorial = () => {
    // Cuando el modal guarda una solicitud exitosa, volvemos a consultar la base de datos
    fetchHistorial();
  };

  // Función auxiliar para mostrar las fechas bonitas (Ej: "12 oct - 18 oct")
  const formatearRangoFechas = (inicio, fin) => {
    if (!inicio || !fin) return "Fecha no disponible";
    const opciones = { day: '2-digit', month: 'short' };
    
    // Agregamos 'T00:00:00' para evitar problemas de zona horaria al parsear
    const fInicio = new Date(inicio.split('T')[0] + 'T00:00:00').toLocaleDateString('es-MX', opciones);
    const fFin = new Date(fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-MX', opciones);
    
    return `${fInicio} - ${fFin}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-4">
      
      {/* HEADER */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Permisos y Vacaciones</h2>
        <p className="text-slate-500 text-sm mt-1">Administra las ausencias y descansos del personal de tu área.</p>
      </div>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* SOLICITAR VACACIONES */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 rounded-bl-full -z-0 opacity-50 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm"><FlightTakeoffIcon fontSize="small" /></div>
                <h3 className="font-bold text-slate-800 text-lg">Asignar Vacaciones</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 relative z-10">Consulta el saldo de días por ley y registra un nuevo periodo de descanso.</p>
            <div className="mt-auto space-y-3 relative z-10">
                <select 
                    value={empleadoBuscado}
                    onChange={(e) => setEmpleadoBuscado(e.target.value)}
                    className="w-full text-sm border border-slate-200 text-slate-700 py-2.5 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer"
                >
                    <option value="">-- Selecciona un Empleado --</option>
                    {empleados.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.empleado} ({emp.departamento})</option>
                    ))}
                </select>
                <button 
                    onClick={handleAbrirVacaciones}
                    disabled={!empleadoBuscado}
                    className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-sm"
                >
                    Iniciar Solicitud
                </button>
            </div>
        </div>

        {/* PERMISOS DE 4 HORAS */}
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 flex flex-col relative overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl"><SickIcon fontSize="small" /></div>
                <h3 className="font-bold text-slate-800 text-lg">Permisos de 4 Horas</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">Solicita un permiso de 4 horas para ausencias breves (4 horas por mes).</p>
            <button className="mt-auto w-full bg-white border-2 border-rose-100 text-rose-600 font-semibold py-2 rounded-lg hover:bg-rose-50 transition-all">
                Registrar Permiso
            </button>
        </div>

        {/* PERMISOS ECONOMICOS */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 flex flex-col relative overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><AccessTimeIcon fontSize="small" /></div>
                <h3 className="font-bold text-slate-800 text-lg">Permisos Economicos</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">Solicita un permiso económico para ausencias justificadas por motivos económicos (1 dia cada 4 meses).</p>
            <button className="mt-auto w-full bg-white border-2 border-emerald-100 text-emerald-600 font-semibold py-2 rounded-lg hover:bg-emerald-50 transition-all">
                Nuevo Permiso
            </button>
        </div>

      </div>

      {/* TABLA DE HISTORIAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Solicitudes Recientes</h3>
            <div className="relative w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon fontSize="small" className="text-slate-400"/></span>
                <input type="text" placeholder="Buscar solicitud..." className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="text-slate-500 font-semibold uppercase text-xs tracking-wider border-b border-slate-100">
                        <th className="px-6 py-4">Empleado</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Fechas</th>
                        <th className="px-6 py-4 text-center">Días</th>
                        <th className="px-6 py-4">Estatus</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {solicitudes.length > 0 ? (
                        solicitudes.map(sol => (
                            <tr key={sol.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-800">{sol.empleado}</td>
                                <td className="px-6 py-3 text-slate-600 flex items-center gap-2">
                                    {sol.tipo === 'Vacaciones' ? <FlightTakeoffIcon fontSize="small" className="text-blue-500"/> : <AccessTimeIcon fontSize="small" className="text-emerald-500"/>}
                                    {sol.tipo}
                                </td>
                                <td className="px-6 py-3 text-slate-600 capitalize">
                                    {formatearRangoFechas(sol.fecha_inicio, sol.fecha_fin)}
                                </td>
                                <td className="px-6 py-3 text-center font-semibold text-slate-700">{sol.dias}</td>
                                <td className="px-6 py-3">
                                    {sol.estatus === 'Aprobada' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100"><CheckCircleIcon sx={{fontSize: 14}} /> Aprobada</span>
                                    ) : sol.estatus === 'Pendiente' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100"><PendingActionsIcon sx={{fontSize: 14}} /> Pendiente</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{sol.estatus}</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                No hay solicitudes de vacaciones registradas.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL DE VACACIONES */}
      {modalVacacionesAbierto && empleadoParaVacaciones && (
        <SolicitarVacacionesModal
            empleado={empleadoParaVacaciones}
            onClose={() => {
                setModalVacacionesAbierto(false);
                setEmpleadoParaVacaciones(null);
            }}
            onSolicitudGuardada={recargarHistorial}
        />
      )}

    </div>
  );
}