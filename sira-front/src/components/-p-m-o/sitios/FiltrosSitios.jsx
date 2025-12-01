//C:\SIRA\sira-front\src\components\-p-m-o\sitios\FiltrosSitios.jsx
import React from 'react';
import { Search, Add, PersonAdd } from '@mui/icons-material';

export default function FiltrosSitios({ 
  busqueda, 
  setBusqueda, 
  onNuevoSitio, 
  onNuevoCliente 
}) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      {/* Buscador */}
      <div className="relative w-full md:w-96">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="text-gray-400" style={{ fontSize: 20 }} />
        </div>
        <input
          type="text"
          placeholder="Buscar sitio, cliente o ubicación..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Botones de Acción */}
      <div className="flex gap-3 w-full md:w-auto">
        <button
          onClick={onNuevoCliente}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm w-full md:w-auto shadow-sm"
        >
          <PersonAdd style={{ fontSize: 18, marginRight: '8px' }} />
          Nuevo Cliente
        </button>
        <button
          onClick={onNuevoSitio}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm w-full md:w-auto shadow-sm"
        >
          <Add style={{ fontSize: 18, marginRight: '8px' }} />
          Agregar Sitio
        </button>
      </div>
    </div>
  );
}