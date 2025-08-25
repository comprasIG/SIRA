// src/pages/Dashboard.jsx
import { useAuth } from "../context/authContext";
import { lazy, Suspense } from "react";

export default function Dashboard() {
  
  const { usuario } = useAuth();
  console.log("usuario desde Dashboard.jsx:", usuario);
  const abrev = usuario?.abreviatura?.replace(/-/g, "");

  if (!abrev) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Abreviatura de departamento no disponible.</p>
      </div>
    );
  }

  const DashboardDepto = lazy(() => import(`./dashboards/Dashboard_${abrev}.jsx`).catch(() => ({
    default: () => (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-red-500">No existe dashboard para: {abrev}</p>
      </div>
    )
  })));

  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Cargando dashboard...</div>}>
      <DashboardDepto />
    </Suspense>
  );
}