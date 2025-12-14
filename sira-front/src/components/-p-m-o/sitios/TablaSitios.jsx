// C:\SIRA\sira-front\src\components\-p-m-o\sitios\TablaSitios.jsx
import React from "react";
import { Visibility, Edit } from "@mui/icons-material";

function formatMoney(moneda, value) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${moneda} ${new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }
}

export default function TablaSitios({ sitios, loading, onVerProyectos, onEditar }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500 font-medium">Cargando sitios…</span>
      </div>
    );
  }

  const renderTotalesPorMoneda = (sitio) => {
    const arr = Array.isArray(sitio.oc_totales_por_moneda)
      ? sitio.oc_totales_por_moneda
      : [];

    if (!arr.length) {
      return <span className="text-gray-300">—</span>;
    }

    return (
      <div className="flex flex-col items-end gap-1">
        {arr.map((t) => (
          <div key={`${sitio.id}-${t.moneda}`} className="leading-tight">
            <span className="text-[11px] font-semibold text-gray-500 mr-2">
              {t.moneda}
            </span>
            <span className="font-mono text-sm text-gray-800">
              {formatMoney(t.moneda, t.subtotal)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Sitio</th>
              <th className="p-4 font-semibold">Cliente</th>
              <th className="p-4 font-semibold">Ubicación</th>
              <th className="p-4 font-semibold text-center">Proyectos</th>
              <th className="p-4 font-semibold text-right">Total OC</th>
              <th className="p-4 font-semibold text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {sitios && sitios.length > 0 ? (
              sitios.map((sitio) => (
                <tr
                  key={sitio.id}
                  className="group hover:bg-gray-50 transition-colors"
                >
                  {/* Sitio */}
                  <td className="p-4">
                    <p className="font-semibold text-gray-900 leading-tight">
                      {sitio.nombre}
                    </p>
                  </td>

                  {/* Cliente */}
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                      {sitio.cliente_nombre}
                    </span>
                  </td>

                  {/* Ubicación */}
                  <td
                    className="p-4 text-gray-500 text-sm max-w-xs truncate"
                    title={sitio.ubicacion}
                  >
                    {sitio.ubicacion}
                  </td>

                  {/* Proyectos */}
                  <td className="p-4 text-center">
                    <span
                      className={[
                        "inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold",
                        parseInt(sitio.proyectos_activos_count, 10) > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400",
                      ].join(" ")}
                    >
                      {sitio.proyectos_activos_count}
                    </span>
                  </td>

                  {/* Totales OC */}
                  <td className="p-4 text-right">
                    {renderTotalesPorMoneda(sitio)}
                  </td>

                  {/* Acciones */}
                  <td className="p-4">
                    <div className="flex justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onVerProyectos(sitio)}
                        title="Ver proyectos"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Visibility style={{ fontSize: 18 }} />
                      </button>

                      <button
                        onClick={() => onEditar(sitio)}
                        title="Editar sitio"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                      >
                        <Edit style={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-14 text-center">
                  <div className="flex flex-col items-center text-gray-400">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <Visibility className="text-gray-300" style={{ fontSize: 32 }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">
                      No se encontraron sitios
                    </p>
                    <p className="text-xs mt-1">
                      Ajusta los filtros o crea un nuevo sitio.
                    </p>
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
