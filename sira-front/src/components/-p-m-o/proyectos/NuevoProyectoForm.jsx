// src/components/-p-m-o/proyectos/NuevoProyectoForm.jsx

// ===================================================================
//  IMPORTS
// ===================================================================
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';

// ===================================================================
//  COMPONENTE PRINCIPAL
// ===================================================================
export default function NuevoProyectoForm() {
  // -----------------------------------------------------------------
  //  ESTADO: Catálogos (sitios, usuarios)
  // -----------------------------------------------------------------
  const [sitios, setSitios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // -----------------------------------------------------------------
  //  ESTADO: Campos del formulario
  // -----------------------------------------------------------------
  const [sitioId, setSitioId] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [busquedaResponsable, setBusquedaResponsable] = useState('');
  const [responsableSeleccionado, setResponsableSeleccionado] = useState(null);
  const [showListaResponsables, setShowListaResponsables] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // -----------------------------------------------------------------
  //  ESTADO: UI (carga, errores, mensajes)
// -----------------------------------------------------------------
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ===================================================================
  //  HELPERS: Normalización de respuestas de la API
  // ===================================================================

  /** Normaliza la respuesta de /api/usuarios a un array de usuarios. */
  const normalizarUsuarios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.usuarios)) return raw.usuarios;
    if (raw && Array.isArray(raw.rows)) return raw.rows;
    return [];
  };

  /** Normaliza la respuesta de /api/sitios-dashboard a un array de sitios. */
  const normalizarSitios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.sitios)) return raw.sitios;
    return [];
  };

  // ===================================================================
  //  HELPERS: Lectura de propiedades de usuario
  //  (usamos solo lo que realmente necesitamos)
// ===================================================================

  /** Nombre del usuario (BD: nombre_completo / nombre). */
  const getNombreUsuario = (u) => u?.nombre_completo || u?.nombre || '';

  /** Correo del usuario (BD: correo_google / correo). */
  const getCorreoUsuario = (u) =>
    u?.correo_google || u?.correo || u?.email || '';

  /** Departamento del usuario (BD: departamento). */
  const getDepartamentoUsuario = (u) => u?.departamento || '';

  // ===================================================================
  //  EFECTOS: Carga inicial de catálogos (sitios y usuarios)
  // ===================================================================
  useEffect(() => {
    const fetchData = async () => {
      setLoadingInit(true);
      setError('');
      try {
        const [sitiosRes, usuariosRes] = await Promise.all([
          api.get('/api/sitios-dashboard'),
          api.get('/api/usuarios'),
        ]);

        setSitios(normalizarSitios(sitiosRes));
        setUsuarios(normalizarUsuarios(usuariosRes));
      } catch (err) {
        console.error('Error cargando datos iniciales para Nuevo Proyecto:', err);
        setError(
          'No se pudieron cargar sitios y usuarios. Intenta recargar la página.'
        );
      } finally {
        setLoadingInit(false);
      }
    };

    fetchData();
  }, []);

  // ===================================================================
  //  DERIVADOS: Sitio seleccionado y lista filtrada de responsables
  // ===================================================================

  /** Sitio seleccionado: lo usamos para mostrar el cliente. */
  const selectedSitio = useMemo(
    () => sitios.find((s) => String(s.id) === String(sitioId)),
    [sitioId, sitios]
  );

  /** Lista de responsables filtrados por lo que se escribe en el input. */
  const responsablesFiltrados = useMemo(() => {
    if (!usuarios || usuarios.length === 0) return [];

    const term = busquedaResponsable.trim().toLowerCase();
    if (!term) return usuarios; // sin texto → mostramos todos

    const tokens = term.split(/\s+/).filter(Boolean); // palabras

    return usuarios.filter((u) => {
      const nombre = getNombreUsuario(u);
      const correo = getCorreoUsuario(u);
      const depto = getDepartamentoUsuario(u);

      const haystack = `${nombre} ${correo} ${depto}`.toLowerCase();

      // Todas las palabras escritas deben aparecer en algún lado
      return tokens.every((t) => haystack.includes(t));
    });
  }, [usuarios, busquedaResponsable]);

  // ===================================================================
  //  HANDLERS: Utilidades de formulario
  // ===================================================================

  const resetForm = () => {
    setSitioId('');
    setResponsableId('');
    setBusquedaResponsable('');
    setResponsableSeleccionado(null);
    setShowListaResponsables(false);
    setNombre('');
    setDescripcion('');
  };

  /** Cuando se escribe en el input de responsable. */
  const handleResponsableInputChange = (e) => {
    const value = e.target.value;
    setBusquedaResponsable(value);

    // Si cambia el texto manualmente, invalidamos el seleccionado
    setResponsableId('');
    setResponsableSeleccionado(null);
    // Importante: no tocamos showListaResponsables aquí
    // para que al borrar no se abra sola.
  };

  /** Toggle manual de la lista con la flecha. */
  const toggleListaResponsables = () => {
    setShowListaResponsables((prev) => !prev);
  };

  /** Cuando se selecciona un responsable de la lista. */
  const handleSelectResponsable = (usuario) => {
    const nombre = getNombreUsuario(usuario);
    setResponsableId(String(usuario.id));
    setBusquedaResponsable(nombre || '');
    setResponsableSeleccionado(usuario);
    setShowListaResponsables(false);
  };

  /** Envío del formulario. */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validaciones básicas
    if (!sitioId || !responsableId || !nombre.trim() || !descripcion.trim()) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }

    if (nombre.trim().length > 100) {
      setError('El nombre del proyecto no puede exceder 100 caracteres.');
      return;
    }

    if (descripcion.trim().length > 400) {
      setError('La descripción no puede exceder 400 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        responsable_id: Number(responsableId),
        sitio_id: Number(sitioId),
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        // cliente_id se calcula en el backend a partir del sitio
      };

      const response = await api.post('/api/proyectos', payload);
      console.log('Proyecto creado:', response);

      setSuccessMsg('Proyecto creado correctamente.');
      resetForm();
    } catch (err) {
      console.error('Error al crear proyecto:', err);

      if (err && err.message) {
        setError(`Error al crear proyecto: ${err.message}`);
      } else {
        setError('Ocurrió un error al crear el proyecto. Intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ===================================================================
  //  RENDER
  // ===================================================================

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-600">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
        Cargando sitios y usuarios...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* -------------------------------------------------------------- */}
      {/*  Mensajes de error / éxito                                      */}
      {/* -------------------------------------------------------------- */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong className="font-semibold mr-1">Error:</strong>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/*  Campo: Sitio + Cliente                                        */}
      {/* -------------------------------------------------------------- */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sitio <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          value={sitioId}
          onChange={(e) => setSitioId(e.target.value)}
        >
          <option value="">Selecciona un sitio...</option>
          {sitios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>

        {/* Cliente (solo lectura) */}
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <input
            type="text"
            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
            value={
              selectedSitio
                ? selectedSitio.cliente_nombre ||
                  (selectedSitio.cliente_id
                    ? `ID cliente: ${selectedSitio.cliente_id}`
                    : 'Cliente no definido en el sitio')
                : 'Selecciona un sitio para ver el cliente asociado'
            }
            disabled
          />
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Campo: Responsable del proyecto                               */}
      {/* -------------------------------------------------------------- */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Responsable del proyecto <span className="text-red-500">*</span>
        </label>

        <div className="flex items-center gap-2 mb-2">
          {/* Input de búsqueda/escritura */}
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Escribe parte del nombre, correo o departamento..."
            value={busquedaResponsable}
            onChange={handleResponsableInputChange}
          />

          {/* Botón flecha para mostrar/ocultar la lista */}
          <button
            type="button"
            onClick={toggleListaResponsables}
            className="border border-gray-300 rounded-lg px-2 py-2 bg-white hover:bg-gray-50 flex items-center justify-center"
            title={showListaResponsables ? 'Ocultar lista' : 'Mostrar lista'}
          >
            <span className="text-gray-600 text-xs">
              {showListaResponsables ? '▲' : '▼'}
            </span>
          </button>
        </div>

        {/* Lista de usuarios filtrados (colapsable) */}
        {showListaResponsables && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white text-sm">
            {responsablesFiltrados.length === 0 ? (
              <div className="px-3 py-2 text-gray-400">
                No se encontraron usuarios que coincidan.
              </div>
            ) : (
              responsablesFiltrados.map((u) => {
                const estaSeleccionado = String(u.id) === String(responsableId);
                const nombreU = getNombreUsuario(u);
                const correoU = getCorreoUsuario(u);
                const deptoU = getDepartamentoUsuario(u);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectResponsable(u)}
                    className={
                      'w-full text-left px-3 py-2 flex flex-col border-b border-gray-100 last:border-b-0 hover:bg-blue-50 ' +
                      (estaSeleccionado ? 'bg-blue-50' : '')
                    }
                  >
                    <span className="font-medium text-gray-800">
                      {nombreU || '(Sin nombre)'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {correoU || 'Sin correo'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {deptoU || 'Sin departamento'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Info del responsable seleccionado */}
        {responsableSeleccionado && (
          <div className="mt-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <div>
              <span className="font-semibold">Seleccionado: </span>
              {getNombreUsuario(responsableSeleccionado) || '(Sin nombre)'}
            </div>
            <div>
              <span className="font-semibold">Correo: </span>
              {getCorreoUsuario(responsableSeleccionado) || 'Sin correo'}
            </div>
            <div>
              <span className="font-semibold">Departamento: </span>
              {getDepartamentoUsuario(responsableSeleccionado) ||
                'Sin departamento'}
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Campo: Nombre del proyecto                                   */}
      {/* -------------------------------------------------------------- */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del proyecto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Ej. Mantenimiento Planta Norte, Instalación Línea 3..."
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
        />
        <p className="text-xs text-gray-400 mt-1">Máx. 100 caracteres.</p>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Campo: Descripción                                            */}
      {/* -------------------------------------------------------------- */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción <span className="text-red-500">*</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={4}
          placeholder="Describe brevemente el objetivo y alcance del proyecto..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={400}
        />
        <p className="text-xs text-gray-400 mt-1">Máx. 400 caracteres.</p>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Acciones                                                      */}
      {/* -------------------------------------------------------------- */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={resetForm}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          Limpiar
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  );
}
