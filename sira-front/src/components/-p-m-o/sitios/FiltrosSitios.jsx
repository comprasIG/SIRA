// C:\SIRA\sira-front\src\components\-p-m-o\sitios\FiltrosSitios.jsx
import React from "react";
import { Search, AddBusiness, AddLocationAlt } from "@mui/icons-material";
import { motion } from "framer-motion";

/**
 * Filtros Sitios
 * Props:
 * - busqueda: string
 * - setBusqueda: (v: string) => void
 * - onNuevoSitio: () => void
 * - onNuevoCliente: () => void
 */
export default function FiltrosSitios({
  busqueda,
  setBusqueda,
  onNuevoSitio,
  onNuevoCliente,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 mb-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            Buscar sitio / cliente / ubicación
          </label>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search style={{ fontSize: 20 }} />
            </div>

            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. Planta, IG BIOGAS, Monterrey…"
              className={[
                "w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200",
                "bg-white text-gray-900 placeholder:text-gray-400",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                "transition-all",
              ].join(" ")}
            />
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Tip: puedes buscar por cualquier parte del texto.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <button
            type="button"
            onClick={onNuevoCliente}
            className={[
              "inline-flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-xl border",
              "border-gray-200 bg-white text-gray-700",
              "hover:bg-gray-50 hover:border-gray-300",
              "active:scale-[0.99] transition-all",
              "shadow-sm",
            ].join(" ")}
          >
            <AddBusiness style={{ fontSize: 20 }} />
            Nuevo cliente
          </button>

          <button
            type="button"
            onClick={onNuevoSitio}
            className={[
              "inline-flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-xl border",
              "border-blue-600 bg-blue-600 text-white",
              "hover:bg-blue-700 hover:border-blue-700",
              "active:scale-[0.99] transition-all",
              "shadow-sm",
            ].join(" ")}
          >
            <AddLocationAlt style={{ fontSize: 20 }} />
            Nuevo sitio
          </button>
        </div>
      </div>
    </motion.div>
  );
}
