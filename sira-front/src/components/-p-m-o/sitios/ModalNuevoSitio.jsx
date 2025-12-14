// C:\SIRA\sira-front\src\components\-p-m-o\sitios\ModalNuevoSitio.jsx

import React, { useState, useEffect } from 'react';
import { Close, Save, LocationOn, Business } from '@mui/icons-material';
import api from '../../../api/api';

/**
 * Modal para crear / editar un Sitio.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSave: (payload: { id?, nombre, ubicacion, clienteId }) => Promise | void
 * - sitioEditar: objeto sitio (opcional) con { id, nombre, ubicacion, cliente_id | cliente }
 */
export default function ModalNuevoSitio({
  isOpen,
  onClose,
  onSave,
  sitioEditar = null,
}) {
  // ---------------------------------------------------------------------------
  // Estado del formulario
  // ---------------------------------------------------------------------------
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [clienteId, setClienteId] = useState('');

  // ---------------------------------------------------------------------------
  // Estado de catálogos y UI
  // ---------------------------------------------------------------------------
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Efecto: inicializar formulario al abrir / cambiar sitioEditar
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    setError('');

    if (sitioEditar) {
      setNombre(sitioEditar.nombre || '');
      setUbicacion(sitioEditar.ubicacion || '');
      // Intentamos distintas claves por seguridad
      const cid =
        sitioEditar.cliente_id ||
        sitioEditar.clienteId ||
        sitioEditar.cliente ||
        '';
      setClienteId(cid ? String(cid) : '');
    } else {
      setNombre('');
      setUbicacion('');
      setClienteId('');
    }
  }, [isOpen, sitioEditar]);

  // ---------------------------------------------------------------------------
  // Efecto: cargar lista de clientes al abrir el modal
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const fetchClientes = async () => {
      setLoadingClientes(true);
      setError('');
      try {
        // api.get devuelve el JSON directo (no .data)
        const resp = await api.get('/api/sitios-dashboard/clientes-list');

        let list = [];
        if (Array.isArray(resp)) {
          list = resp;
        } else if (resp && Array.isArray(resp.clientes)) {
          list = resp.clientes;
        } else if (resp && Array.isArray(resp.rows)) {
          list = resp.rows;
        }

        setClientes(list);
      } catch (err) {
        console.error('Error cargando clientes para ModalNuevoSitio:', err);
        setError(
          'No se pudo cargar la lista de clientes. Intenta recargar la página.'
        );
        setClientes([]);
      } finally {
        setLoadingClientes(false);
      }
    };

    fetchClientes();
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleClose = () => {
    if (saving) return; // evitamos cerrar mientras guarda
    setError('');
    onClose && onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validaciones básicas
    if (!nombre.trim() || !ubicacion.trim() || !clienteId) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        clienteId: Number(clienteId),
      };

      if (sitioEditar && sitioEditar.id) {
        payload.id = sitioEditar.id;
      }

      // Dejamos que el padre maneje la llamada al backend
      const maybePromise = onSave && onSave(payload);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }

      // Si todo fue bien, limpiamos y cerramos
      setNombre('');
      setUbicacion('');
      setClienteId('');
      onClose && onClose();
    } catch (err) {
      console.error('Error al guardar sitio desde ModalNuevoSitio:', err);
      setError(
        err?.message ||
          'Ocurrió un error al guardar el sitio. Intenta de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: si el modal no está abierto, no pintamos nada
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  const titulo = sitioEditar ? 'Editar Sitio' : 'Nuevo Sitio';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <Close fontSize="small" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente asociado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Business className="text-gray-400" style={{ fontSize: 20 }} />
              </div>
              <select
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                disabled={loadingClientes || saving}
              >
                <option value="">
                  {loadingClientes
                    ? 'Cargando clientes...'
                    : 'Selecciona un cliente...'}
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Sitio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LocationOn
                  className="text-gray-400"
                  style={{ fontSize: 20 }}
                />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej. Planta Norte, Almacén Central..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej. Carretera 57 km 123, Querétaro..."
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              disabled={saving}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-lg text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={saving || loadingClientes}
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save style={{ fontSize: 18 }} />
                {sitioEditar ? 'Actualizar Sitio' : 'Guardar Sitio'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
