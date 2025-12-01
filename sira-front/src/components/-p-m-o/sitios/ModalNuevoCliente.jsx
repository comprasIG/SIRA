//C:\SIRA\sira-front\src\components\-p-m-o\sitios\ModalNuevoCliente.jsx
import React, { useState } from 'react';
import { X, Save, User, FileText } from 'lucide-react';
// Importación con extensión explícita para evitar errores de compilación
import { api } from '../../../api/api.js';

export default function ModalNuevoCliente({ isOpen, onClose, onSave }) {
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!razonSocial.trim() || !rfc.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        razon_social: razonSocial.trim(),
        rfc: rfc.trim().toUpperCase()
      };

      // Llamamos a la función onSave que vendrá del padre, o hacemos la petición aquí si preferimos encapsularlo
      // Para consistencia con el modal anterior, asumiremos que onSave maneja la lógica o devuelve una promesa
      await onSave(dataToSave);
      
      onClose();
      // Limpiar campos
      setRazonSocial('');
      setRfc('');
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      // Si el error viene del backend (ej. RFC duplicado)
      if (err.response && err.response.data && err.response.data.error) {
         setError(err.response.data.error);
      } else {
         setError('Ocurrió un error al guardar el cliente.');
      }
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
            Nuevo Cliente
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
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
                <User className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Ej. Empresa SA de CV"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
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
                <FileText className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase"
                placeholder="RFC de la empresa"
                value={rfc}
                onChange={(e) => setRfc(e.target.value)}
              />
            </div>
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
                <Save className="w-4 h-4" />
                Guardar Cliente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}