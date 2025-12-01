//C:\SIRA\sira-front\src\components\-p-m-o\sitios\sitios_kpi.jsx
import React from 'react';
import { Building2, MapPin, Activity } from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-all hover:shadow-md">
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

export default function KPISitios({ data }) {
  // Aseguramos que data no sea null/undefined para evitar errores
  const safeData = data || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <KPICard 
        title="Total Clientes" 
        value={safeData.total_clientes || 0} 
        icon={Building2} 
        color="bg-blue-500" 
      />
      <KPICard 
        title="Sitios Registrados" 
        value={safeData.total_sitios || 0} 
        icon={MapPin} 
        color="bg-emerald-500" 
      />
      <KPICard 
        title="Proyectos Activos" 
        value={safeData.proyectos_activos || 0} 
        icon={Activity} 
        color="bg-purple-500" 
      />
    </div>
  );
}