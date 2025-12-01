//C:\SIRA\sira-front\src\components\-p-m-o\sitios\TablaSitios.jsx
import React from 'react';
import { Eye, Edit2 } from 'lucide-react';

export default function TablaSitios({ sitios, loading, onVerProyectos, onEditar }) {
  if (loading) return (
    <div className="flex justify-center items-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-500 font-medium">Cargando datos...</span>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Nombre del Sitio</th>
              <th className="p-4 font-semibold">Cliente Asociado</th>
              <th className="p-4 font-semibold">Ubicación</th>
              <th className="p-4 font-semibold text-center">Proyectos Activos</th>
              <th className="p-4 font-semibold text-right">Total Gastado</th>
              <th className="p-4 font-semibold text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sitios && sitios.length > 0 ? (
              sitios.map((sitio) => (
                <tr key={sitio.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4 font-medium text-gray-900">{sitio.nombre}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {sitio.cliente_nombre}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm max-w-xs truncate" title={sitio.ubicacion}>
                    {sitio.ubicacion}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${
                      parseInt(sitio.proyectos_activos_count) > 0 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {sitio.proyectos_activos_count}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-gray-700">
                    ${parseFloat(sitio.total_gastado).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onVerProyectos(sitio)}
                        title="Ver Proyectos"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onEditar(sitio)}
                        title="Editar Sitio"
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <Eye className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium">No se encontraron sitios</p>
                    <p className="text-xs mt-1">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}