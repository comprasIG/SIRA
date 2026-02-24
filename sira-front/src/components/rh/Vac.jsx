// C:\SIRA\sira-front\src\components\rh\Vac.jsx
import React, { useState, useEffect, useMemo } from 'react';

// --- ICONOS MUI ---
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import EventBusyIcon from '@mui/icons-material/EventBusy';


import { useAuth } from "../../context/authContext";
const API_BASE_URL = import.meta.env.VITE_API_URL;


export default function Vac() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Pendiente'); // Por defecto vemos las pendientes

  // Cargar datos
  const fetchSolicitudes = async () => {
    try {
      setLoading(true);
      if (!API_BASE_URL) {
        setSolicitudes(mockSolicitudes);
        setLoading(false);
        return;
      }

      // En producción llamarás a la ruta que trae TODAS las solicitudes
      const response = await fetch(`${API_BASE_URL}/api/vacaciones/historial`);
      if (!response.ok) throw new Error('Error al obtener solicitudes');
      const data = await response.json();
      setSolicitudes(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  // Función para aprobar o rechazar
  const handleCambiarEstatus = async (id, nuevoEstatus) => {
    const accion = nuevoEstatus === 'Aprobada' ? 'Aprobar' : 'Rechazar';
    if (!window.confirm(`¿Estás seguro de ${accion} esta solicitud?`)) return;

    try {
        if (!API_BASE_URL) {
            // Lógica para la simulación
            setSolicitudes(prev => prev.map(sol => sol.id === id ? { ...sol, estatus: nuevoEstatus } : sol));
            return;
        }

        // --- EN PRODUCCIÓN: LLAMADA AL BACKEND ---
        // Debes crear este endpoint en tu backend: PUT /api/vacaciones/:id/estatus
        
        const response = await fetch(`${API_BASE_URL}/api/vacaciones/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estatus: nuevoEstatus })
        });
        if (!response.ok) throw new Error('Error al actualizar');
        

        // Actualizamos el estado local
        setSolicitudes(prev => prev.map(sol => sol.id === id ? { ...sol, estatus: nuevoEstatus } : sol));

    } catch (error) {
        console.error("Error al actualizar estatus:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
  };

  // Filtrado de la tabla
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter(sol => {
        const coincideEstatus = filtroEstatus === 'Todas' || sol.estatus === filtroEstatus;
        const termino = busqueda.toLowerCase();
        const coincideBusqueda = sol.empleado?.toLowerCase().includes(termino) || sol.departamento?.toLowerCase().includes(termino);
        
        return coincideEstatus && coincideBusqueda;
    });
  }, [solicitudes, busqueda, filtroEstatus]);

  // KPIs
  const kpis = useMemo(() => {
      return {
          pendientes: solicitudes.filter(s => s.estatus === 'Pendiente').length,
          aprobadas: solicitudes.filter(s => s.estatus === 'Aprobada').length,
          rechazadas: solicitudes.filter(s => s.estatus === 'Rechazada').length,
      };
  }, [solicitudes]);

  // Formateadores
  const formatearRangoFechas = (inicio, fin) => {
    if (!inicio || !fin) return "N/A";
    const opciones = { day: '2-digit', month: 'short' };
    const fInicio = new Date(inicio.split('T')[0] + 'T00:00:00').toLocaleDateString('es-MX', opciones);
    const fFin = new Date(fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-MX', opciones);
    return `${fInicio} - ${fFin}`;
  };

  const formatearFechaSolicitud = (fecha) => {
      if(!fecha) return "N/A";
      return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-4">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Autorización de Vacaciones</h2>
          <p className="text-slate-500 text-sm mt-1">Bandeja de entrada de RH para gestionar descansos del personal.</p>
        </div>
      </div>

      {/* KPIS / RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1 bg-amber-500"></div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pendientes de Revisión</p>
                <h3 className="text-3xl font-black text-amber-600">{kpis.pendientes}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-500 rounded-xl"><PendingActionsIcon fontSize="large"/></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500"></div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Aprobadas (Histórico)</p>
                <h3 className="text-3xl font-black text-emerald-600">{kpis.aprobadas}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><CheckCircleIcon fontSize="large"/></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1 bg-rose-500"></div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Rechazadas</p>
                <h3 className="text-3xl font-black text-rose-600">{kpis.rechazadas}</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl"><EventBusyIcon fontSize="large"/></div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL TABLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        
        {/* BARRA DE HERRAMIENTAS Y PESTAÑAS */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
            
            {/* Pestañas de estado */}
            <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg w-full lg:w-auto overflow-x-auto">
                {['Pendiente', 'Aprobada', 'Rechazada', 'Todas'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFiltroEstatus(tab)}
                        className={`
                            px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap
                            ${filtroEstatus === tab 
                                ? 'bg-white text-blue-700 shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'}
                        `}
                    >
                        {tab} {tab === 'Pendiente' && kpis.pendientes > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px]">{kpis.pendientes}</span>}
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <div className="relative w-full lg:w-72">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon fontSize="small" className="text-slate-400"/></span>
                <input 
                    type="text" 
                    placeholder="Buscar empleado o depto..." 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
            </div>
        </div>

        {/* TABLA */}
        <div className="overflow-x-auto min-h-[400px]">
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-4">Fecha Solicitud</th>
                        <th className="px-6 py-4">Empleado / Depto</th>
                        <th className="px-6 py-4">Periodo Solicitado</th>
                        <th className="px-6 py-4 text-center">Días</th>
                        <th className="px-6 py-4 text-center">Estatus</th>
                        <th className="px-6 py-4 text-center">Acciones (RH)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="6" className="text-center py-10 text-slate-500">Cargando solicitudes...</td></tr>
                    ) : solicitudesFiltradas.length > 0 ? (
                        solicitudesFiltradas.map(sol => (
                            <tr key={sol.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                    {formatearFechaSolicitud(sol.fecha_solicitud)}
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-800">{sol.empleado}</p>
                                    <p className="text-xs text-slate-500">{sol.departamento}</p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-700 capitalize font-medium flex items-center gap-2">
                                    <FlightTakeoffIcon fontSize="small" className="text-blue-400"/>
                                    {formatearRangoFechas(sol.fecha_inicio, sol.fecha_fin)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                                        {sol.dias}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                    {sol.estatus === 'Pendiente' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>}
                                    {sol.estatus === 'Aprobada' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aprobada</span>}
                                    {sol.estatus === 'Rechazada' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Rechazada</span>}
                                </td>
                                
                                {/* BOTONES DE ACCIÓN: SOLO VISIBLES SI ESTÁ PENDIENTE */}
                                <td className="px-6 py-4 text-center">
                                    {sol.estatus === 'Pendiente' ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => handleCambiarEstatus(sol.id, 'Aprobada')}
                                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200"
                                                title="Aprobar Solicitud"
                                            >
                                                <CheckCircleIcon fontSize="small" />
                                            </button>
                                            <button 
                                                onClick={() => handleCambiarEstatus(sol.id, 'Rechazada')}
                                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200"
                                                title="Rechazar Solicitud"
                                            >
                                                <CancelIcon fontSize="small" />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">Procesada</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                <div className="flex flex-col items-center justify-center">
                                    <FilterListIcon className="text-slate-300 mb-2" sx={{fontSize: 40}} />
                                    <p>No hay solicitudes en la bandeja de "{filtroEstatus}".</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}