// C:\SIRA\sira-front\src\components\-p-m-o\sitios\sitios_kpi.jsx
import React from "react";
import { motion } from "framer-motion";
import { Business, Place, AccountTree } from "@mui/icons-material";

/**
 * KPIs de Sitios
 * Props:
 * - data: { total_clientes, total_sitios, proyectos_activos }
 */
export default function KPISitios({ data }) {
  const items = [
    {
      key: "total_clientes",
      label: "Clientes",
      value: data?.total_clientes ?? 0,
      icon: <Business style={{ fontSize: 20 }} />,
      accent: "text-blue-700",
      bg: "bg-blue-50",
      ring: "ring-blue-100",
    },
    {
      key: "total_sitios",
      label: "Sitios",
      value: data?.total_sitios ?? 0,
      icon: <Place style={{ fontSize: 20 }} />,
      accent: "text-emerald-700",
      bg: "bg-emerald-50",
      ring: "ring-emerald-100",
    },
    {
      key: "proyectos_activos",
      label: "Proyectos activos",
      value: data?.proyectos_activos ?? 0,
      icon: <AccountTree style={{ fontSize: 20 }} />,
      accent: "text-violet-700",
      bg: "bg-violet-50",
      ring: "ring-violet-100",
    },
  ];

  return (
    <section className="mb-6">
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {items.map((kpi) => (
          <motion.div
            key={kpi.key}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="p-5 flex items-center justify-between">
              {/* Texto */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight">
                  {kpi.value}
                </p>
                <div className="mt-2 h-1 w-10 rounded-full bg-gray-100" />
              </div>

              {/* Icono */}
              <div
                className={[
                  "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                  "ring-1",
                  kpi.bg,
                  kpi.ring,
                  kpi.accent,
                ].join(" ")}
              >
                {kpi.icon}
              </div>
            </div>

            {/* Línea inferior sutil */}
            <div className="px-5 pb-4">
              <div className="h-[1px] bg-gradient-to-r from-gray-100 via-gray-50 to-transparent" />
              <p className="pt-3 text-xs text-gray-400">
                Actualizado en tiempo real
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
