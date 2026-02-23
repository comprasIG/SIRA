import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import CloseIcon from '@mui/icons-material/Close';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import SendIcon from '@mui/icons-material/Send';
import { CircularProgress } from '@mui/material';

// En producción:
const API_BASE_URL = import.meta.env.VITE_API_URL;
import { toast } from 'react-toastify';

export default function SolicitarVacacionesModal({ empleado, onClose, onSolicitudGuardada }) {
  const [saldo, setSaldo] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(true);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      fecha_inicio: '',
      fecha_fin: '',
      fecha_retorno: '',
      dias_solicitados: '',
      observaciones: ''
    }
  });

  const fechaInicio = watch('fecha_inicio');
  const fechaFin = watch('fecha_fin');

  // 1. CARGAR EL SALDO AL ABRIR EL MODAL
  useEffect(() => {
    if (!empleado || !empleado.id) return;

    const cargarSaldo = async () => {
      try {
        setLoadingSaldo(true);
        // Llamada a la ruta GET /api/vacaciones/saldo/:id
        const response = await fetch(`${API_BASE_URL}/api/vacaciones/saldo/${empleado.id}`);
        const data = await response.json();
        setSaldo(data);
      } catch (error) {
        console.error("Error al cargar saldo:", error);
        toast.error("No se pudo cargar el saldo de vacaciones del empleado.");
      } finally {
        setLoadingSaldo(false);
      }
    };

    cargarSaldo();
  }, [empleado]);

  // 2. ENVIAR LA SOLICITUD
  const onSubmit = async (data) => {
    if (!saldo) return;

    // Validación extra: No pedir más días de los disponibles
    if (Number(data.dias_solicitados) > saldo.dias_disponibles) {
        alert("Atención: Los días solicitados superan el saldo disponible.");
        // Si las políticas de tu empresa lo prohíben, puedes poner un return aquí para bloquearlo.
    }

    const payload = {
        empleado_id: empleado.id,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        fecha_retorno: data.fecha_retorno || null,
        dias_solicitados: Number(data.dias_solicitados),
        periodo_antiguedad: saldo.periodo_actual,
        observaciones: data.observaciones
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/vacaciones/solicitar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error("Error al registrar la solicitud de vacaciones");
        }

        toast.success("Solicitud de vacaciones registrada exitosamente.");
        if (onSolicitudGuardada) onSolicitudGuardada();
        onClose();
    } catch (error) {
        console.error("Error al registrar solicitud:", error);
        toast.error("Hubo un error al procesar la solicitud.");
    }
  };

  const inputStyle = `
    w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
    focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 
    outline-none transition-all
  `;

  const labelStyle = "block text-xs font-bold text-gray-500 uppercase mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* --- ENCABEZADO --- */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <FlightTakeoffIcon />
            <div>
                <h2 className="text-xl font-bold tracking-wide">Solicitar Vacaciones</h2>
                <p className="text-blue-100 text-sm">{empleado?.empleado || empleado?.nombre_completo || "Empleado"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition">
            <CloseIcon />
          </button>
        </div>

        {/* --- CUERPO --- */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-slate-50/50">
            
            {loadingSaldo ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <CircularProgress size={32} className="text-blue-600" />
                    <p className="text-gray-500 text-sm font-medium">Calculando saldo del empleado...</p>
                </div>
            ) : saldo ? (
                <div className="space-y-8">
                    
                    {/* TARJETAS DE SALDO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500"></div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><EventAvailableIcon /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Días por Ley (Año {saldo.periodo_actual})</p>
                                <p className="text-2xl font-black text-gray-800">{saldo.dias_por_ley}</p>
                            </div>
                        </div>
                        
                        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 h-full w-1 bg-rose-500"></div>
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg"><EventBusyIcon /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Días Consumidos</p>
                                <p className="text-2xl font-black text-gray-800">{saldo.dias_gastados}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-md relative overflow-hidden ring-1 ring-emerald-500/20">
                            <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500"></div>
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><BeachAccessIcon /></div>
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase">Saldo Disponible</p>
                                <p className="text-3xl font-black text-emerald-600">{saldo.dias_disponibles}</p>
                            </div>
                        </div>
                    </div>

                    {/* FORMULARIO DE SOLICITUD */}
                    <form id="vacaciones-form" onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                        <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-2">Detalles del Periodo</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelStyle}>Fecha de Inicio <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    {...register('fecha_inicio', { required: "Requerido" })} 
                                    className={inputStyle}
                                />
                                {errors.fecha_inicio && <span className="text-red-500 text-xs mt-1 block">{errors.fecha_inicio.message}</span>}
                            </div>
                            
                            <div>
                                <label className={labelStyle}>Fecha de Fin <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    {...register('fecha_fin', { 
                                        required: "Requerido",
                                        validate: value => !fechaInicio || new Date(value) >= new Date(fechaInicio) || "La fecha fin debe ser mayor a la de inicio"
                                    })} 
                                    className={inputStyle}
                                />
                                {errors.fecha_fin && <span className="text-red-500 text-xs mt-1 block">{errors.fecha_fin.message}</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelStyle}>Fecha de Retorno a labores</label>
                                <input 
                                    type="date" 
                                    {...register('fecha_retorno', {
                                        validate: value => !value || !fechaFin || new Date(value) > new Date(fechaFin) || "El retorno debe ser posterior a la fecha fin"
                                    })} 
                                    className={inputStyle}
                                />
                                <p className="text-xs text-gray-400 mt-1">Día exacto en que el empleado se reincorpora.</p>
                                {errors.fecha_retorno && <span className="text-red-500 text-xs mt-1 block">{errors.fecha_retorno.message}</span>}
                            </div>

                            <div>
                                <label className={labelStyle}>Días Hábiles a Descontar <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="1"
                                        step="1"
                                        {...register('dias_solicitados', { 
                                            required: "Ingresa la cantidad de días",
                                            min: { value: 1, message: "Debe ser mayor a 0" }
                                        })} 
                                        className={`${inputStyle} pr-12 text-lg font-bold text-blue-700`}
                                        placeholder="Ej. 5"
                                    />
                                    <span className="absolute right-4 top-2.5 text-gray-400 font-medium">días</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Total de días que se restarán de su saldo (excluyendo fines de semana/feriados si aplica).</p>
                                {errors.dias_solicitados && <span className="text-red-500 text-xs mt-1 block">{errors.dias_solicitados.message}</span>}
                            </div>
                        </div>

                        <div>
                            <label className={labelStyle}>Observaciones / Comentarios</label>
                            <textarea 
                                {...register('observaciones')} 
                                rows="3"
                                className={inputStyle}
                                placeholder="Motivo o anotaciones adicionales..."
                            ></textarea>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="text-center py-10 text-red-500 font-medium">
                    No se pudo recuperar la información del empleado.
                </div>
            )}

        </div>

        {/* --- FOOTER DE ACCIONES --- */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition"
          >
            Cancelar
          </button>
          
          <button 
            type="submit"
            form="vacaciones-form"
            disabled={isSubmitting || loadingSaldo || !saldo}
            className={`
              flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all
              ${(isSubmitting || !saldo) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 shadow-blue-200'}
            `}
          >
            {isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            Registrar Solicitud
          </button>
        </div>

      </div>
    </div>
  );
}