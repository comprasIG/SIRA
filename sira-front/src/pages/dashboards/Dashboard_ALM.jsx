// src/pages/dashboards/Dashboard_ALM.jsx

export default function Dashboard_ALM() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard de ALMACÉN</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-indigo-700">Resumen del Departamento</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Indicadores clave de almacén</li>
          <li>Actividades recientes</li>
          <li>Alertas o pendientes</li>
        </ul>
      </div>
    </div>
  );
}