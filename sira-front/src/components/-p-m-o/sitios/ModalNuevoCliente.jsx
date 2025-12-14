// C:\SIRA\sira-front\src\components\-p-m-o\sitios\ModalNuevoCliente.jsx
import React, { useState, useEffect } from 'react';
import { Close, Save, Business, Description } from '@mui/icons-material';

/**
 * Modal para crear un Cliente
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSave: (payload: { razon_social, rfc }) => Promise<void>
 */
export default function ModalNuevoCliente({ isOpen, onClose, onSave }) {
  // ---------------------------------------------------------------------------
  // Estado del formulario
  // ---------------------------------------------------------------------------
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');

  // ---------------------------------------------------------------------------
  // Estado UI
  // ---------------------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Efecto: limpiar errores al abrir
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getErrorMessage = (err) => {
    // Compatibilidad con distintos formatos de error (api helper / backend / Error nativo)
    return (
      err?.data?.error ||
      err?.error ||
      err?.message ||
      'Ocurrió un error al guardar el cliente.'
    );
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleClose = () => {
    if (saving) return;
    setError('');
    onClose && onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const rs = razonSocial.trim();
    const rf = rfc.trim().toUpperCase();

    if (!rs || !rf) {
      setError('Por favor completa Razón Social y RFC.');
      return;
    }

    setSaving(true);
    try {
      const payload = { razon_social: rs, rfc: rf };

      // El padre (Sitios.jsx) es quien hace el POST: /api/sitios-dashboard/cliente
      await onSave(payload);

      // Reset + cerrar
      setRazonSocial('');
      setRfc('');
      onClose && onClose();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Nuevo Cliente</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <Close style={{ fontSize: 24 }} />
          </button>
        </div>

        {/* Body + Footer (todo dentro del FORM) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          {/* Razón Social */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón Social <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Business className="text-gray-400" style={{ fontSize: 20 }} />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Ej. Empresa SA de CV"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* RFC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RFC <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Description className="text-gray-400" style={{ fontSize: 20 }} />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase"
                placeholder="RFC de la empresa"
                value={rfc}
                onChange={(e) => setRfc(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
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
                  Guardar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
