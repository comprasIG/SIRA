// src/pages/dashboards/Dashboard_VTA.jsx

export default function Dashboard_VTA() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard de VENTAS</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-indigo-700">Resumen del Departamento</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Indicadores clave de ventas</li>
          <li>Actividades recientes</li>
          <li>Alertas o pendientes</li>
        </ul>
      </div>
    </div>
  );
}