import React, { useEffect, useState } from "react";
import { Close, CheckCircle, Cancel } from "@mui/icons-material";
import { AnimatePresence, motion } from "framer-motion";
import api from "../../../api/api";

/**
 * Modal: Ver proyectos de un sitio
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - sitio: { id, nombre, cliente_nombre? }
 */
export default function ModalVerProyectosSitio({ isOpen, onClose, sitio }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proyectos, setProyectos] = useState([]);

  useEffect(() => {
    if (!isOpen || !sitio?.id) return;

    const fetchProyectos = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/api/sitios-dashboard/${sitio.id}/proyectos`);
        setProyectos(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Error cargando proyectos del sitio:", err);
        setError("No se pudieron cargar los proyectos de este sitio.");
        setProyectos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProyectos();
  }, [isOpen, sitio?.id]);

  const handleClose = () => {
    if (loading) return;
    onClose && onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(e) => {
          // cerrar al click fuera
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          initial={{ opacity: 0, scale: 0.98, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 6 }}
          transition={{ duration: 0.15 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Proyectos del sitio</h2>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold text-gray-700">{sitio?.nombre}</span>
                {sitio?.cliente_nombre ? (
                  <>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="text-gray-600">{sitio.cliente_nombre}</span>
                  </>
                ) : null}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Cerrar"
            >
              <Close fontSize="small" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-14 text-gray-500">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
                <span className="ml-3 font-medium">Cargando proyectos...</span>
              </div>
            ) : proyectos.length === 0 ? (
              <div className="py-14 text-center text-gray-400">
                <p className="font-medium text-gray-600">No hay proyectos en este sitio</p>
                <p className="text-sm mt-1">Cuando existan proyectos, aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proyectos.map((p) => (
                  <div
                    key={p.id}
                    className="border border-gray-100 rounded-xl p-4 hover:shadow-sm hover:border-gray-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{p.nombre}</p>

                        {p.descripcion ? (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {p.descripcion}
                          </p>
                        ) : null}

                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-semibold">Responsable:</span>{" "}
                          <span className="text-gray-800">{p.responsable_nombre || "—"}</span>
                          {p.responsable_email ? (
                            <span className="text-gray-400"> • {p.responsable_email}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {p.activo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle style={{ fontSize: 14 }} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                            <Cancel style={{ fontSize: 14 }} /> Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
