//C:\SIRA\sira-front\src\components\-p-m-o\sitios\ModalNuevoSitio.jsx

import React, { useState, useEffect } from 'react';
import { Close, Save, LocationOn, Business } from '@mui/icons-material';
// Usamos ruta absoluta para evitar problemas
import api from '../../../api/api';

export default function ModalNuevoSitio({ isOpen, onClose, onSave, sitioEditar = null }) {
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [clienteId, setClienteId] = useState('');
  
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cargar datos si es edición
  useEffect(() => {
    if (sitioEditar) {
      setNombre(sitioEditar.nombre || '');
      setUbicacion(sitioEditar.ubicacion || '');
      setClienteId(sitioEditar.cliente_id || '');
    } else {
      setNombre('');
      setUbicacion('');
      setClienteId('');
    }
    setError('');
  }, [sitioEditar, isOpen]);

  // Cargar lista de clientes
  useEffect(() => {
    if (isOpen) {
      const fetchClientes = async () => {
        setLoadingClientes(true);
        try {
          const response = await api.get('/sitios-dashboard/clientes-list').catch(() => ({ data: [] }));
          if (Array.isArray(response.data)) {
            setClientes(response.data);
          }
        } catch (err) {
          console.error("Error cargando clientes:", err);
        } finally {
          setLoadingClientes(false);
        }
      };
      fetchClientes();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim() || !ubicacion.trim() || !clienteId) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        cliente_id: clienteId
      };

      if (sitioEditar) {
        dataToSave.id = sitioEditar.id;
      }

      await onSave(dataToSave);
      onClose();
    } catch (err) {
      console.error("Error al guardar:", err);
      setError('Ocurrió un error al guardar el sitio. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            {sitioEditar ? 'Editar Sitio' : 'Agregar Nuevo Sitio'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <Close style={{ fontSize: 24 }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          {/* Campo Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Sitio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LocationOn className="text-gray-400" style={{ fontSize: 20 }} />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Ej. Planta Monterrey, Cedis Norte..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
          </div>

          {/* Campo Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente Asociado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Business className="text-gray-400" style={{ fontSize: 20 }} />
              </div>
              <select
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white appearance-none"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                disabled={loadingClientes}
              >
                <option value="">Selecciona un cliente...</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razon_social}
                  </option>
                ))}
              </select>
              {loadingClientes && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              El sitio pertenecerá exclusivamente a este cliente.
            </p>
          </div>

          {/* Campo Ubicación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación / Dirección <span className="text-red-500">*</span>
            </label>
            <textarea
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Dirección completa del sitio..."
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
            />
          </div>

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save style={{ fontSize: 18, marginRight: '8px' }} />
                {sitioEditar ? 'Actualizar Sitio' : 'Guardar Sitio'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}