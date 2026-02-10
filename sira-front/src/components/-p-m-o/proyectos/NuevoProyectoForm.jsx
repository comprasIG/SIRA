// src/components/-p-m-o/proyectos/NuevoProyectoForm.jsx

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';

export default function NuevoProyectoForm() {
  // -----------------------------------------------------------------
  //  ESTADO: Catálogos (sitios, usuarios, monedas)
  // -----------------------------------------------------------------
  const [sitios, setSitios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [monedas, setMonedas] = useState([]);

  // -----------------------------------------------------------------
  //  ESTADO: Campos base del formulario
  // -----------------------------------------------------------------
  const [sitioId, setSitioId] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [busquedaResponsable, setBusquedaResponsable] = useState('');
  const [responsableSeleccionado, setResponsableSeleccionado] = useState(null);
  const [showListaResponsables, setShowListaResponsables] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // -----------------------------------------------------------------
  //  ESTADO: Campos nuevos (fechas, finanzas)
  // -----------------------------------------------------------------
  const [fechaInicio, setFechaInicio] = useState(''); // YYYY-MM-DD
  const [fechaCierre, setFechaCierre] = useState(''); // YYYY-MM-DD

  const [totalFacturado, setTotalFacturado] = useState(''); // string num
  const [totalFacturadoMoneda, setTotalFacturadoMoneda] = useState('MXN');

  const [costoTotal, setCostoTotal] = useState('');
  const [costoTotalMoneda, setCostoTotalMoneda] = useState('MXN');

  // margen editable (propuesto si monedas iguales)
  const [margenEstimado, setMargenEstimado] = useState('');
  const [margenMoneda, setMargenMoneda] = useState('MXN');
  const [margenEsForzado, setMargenEsForzado] = useState(false);

  // -----------------------------------------------------------------
  //  ESTADO: Hitos (opcionales)
  // -----------------------------------------------------------------
  const [hitosOpen, setHitosOpen] = useState(false);
  const [hitos, setHitos] = useState([]); // { _tmpId, nombre, descripcion, target_date, fecha_realizacion }

  // -----------------------------------------------------------------
  //  ESTADO: UI
  // -----------------------------------------------------------------
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ===================================================================
  //  HELPERS: Normalización de respuestas
  // ===================================================================
  const normalizarUsuarios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.usuarios)) return raw.usuarios;
    if (raw && Array.isArray(raw.rows)) return raw.rows;
    return [];
  };

  const normalizarSitios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.sitios)) return raw.sitios;
    return [];
  };

  const normalizarMonedas = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.monedas)) return raw.monedas;
    if (raw && Array.isArray(raw.rows)) return raw.rows;
    return [];
  };

  // ===================================================================
  //  HELPERS: Lectura de usuario
  // ===================================================================
  const getNombreUsuario = (u) => u?.nombre_completo || u?.nombre || '';
  const getCorreoUsuario = (u) => u?.correo_google || u?.correo || u?.email || '';
  const getDepartamentoUsuario = (u) => u?.departamento || '';

  // ===================================================================
  //  HELPERS: utilidad fechas / números
  // ===================================================================
  const isNonNegNumberOrEmpty = (v) => {
    if (v === '' || v === null || v === undefined) return true;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  };

  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const makeTmpId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const getMonedaCode = (m) => (m?.codigo || m?.code || '').toString().trim().toUpperCase();

  // ===================================================================
  //  EFECTO: carga inicial catálogos
  // ===================================================================
  useEffect(() => {
    const fetchData = async () => {
      setLoadingInit(true);
      setError('');
      try {
        const [sitiosRes, usuariosRes, monedasRes] = await Promise.all([
          api.get('/api/sitios-dashboard'),
          api.get('/api/usuarios'),
          api.get('/api/monedas'),
        ]);

        setSitios(normalizarSitios(sitiosRes));
        setUsuarios(normalizarUsuarios(usuariosRes));

        const m = normalizarMonedas(monedasRes);
        setMonedas(m);

        // ✅ default MXN si existe, si no, primera moneda
        const mxn = m.find((x) => getMonedaCode(x) === 'MXN');
        const fallback = mxn ? 'MXN' : (getMonedaCode(m?.[0]) || 'MXN');

        setTotalFacturadoMoneda((prev) => prev || fallback);
        setCostoTotalMoneda((prev) => prev || fallback);
        setMargenMoneda((prev) => prev || fallback);
      } catch (err) {
        console.error('Error cargando datos iniciales para Nuevo Proyecto:', err);
        setError('No se pudieron cargar sitios/usuarios/monedas. Intenta recargar la página.');
      } finally {
        setLoadingInit(false);
      }
    };

    fetchData();
  }, []);

  // ===================================================================
  //  DERIVADOS: sitio seleccionado y lista filtrada de responsables
  // ===================================================================
  const selectedSitio = useMemo(
    () => sitios.find((s) => String(s.id) === String(sitioId)),
    [sitioId, sitios]
  );

  const responsablesFiltrados = useMemo(() => {
    if (!usuarios || usuarios.length === 0) return [];

    const term = busquedaResponsable.trim().toLowerCase();
    if (!term) return usuarios;

    const tokens = term.split(/\s+/).filter(Boolean);

    return usuarios.filter((u) => {
      const nombreU = getNombreUsuario(u);
      const correoU = getCorreoUsuario(u);
      const deptoU = getDepartamentoUsuario(u);
      const haystack = `${nombreU} ${correoU} ${deptoU}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [usuarios, busquedaResponsable]);

  // ===================================================================
  //  DERIVADOS: margen sugerido (solo si monedas coinciden)
  // ===================================================================
  const margenSugerido = useMemo(() => {
    const tf = Number(totalFacturado);
    const ct = Number(costoTotal);
    const tfOk = totalFacturado !== '' && Number.isFinite(tf);
    const ctOk = costoTotal !== '' && Number.isFinite(ct);

    const m1 = (totalFacturadoMoneda || '').trim().toUpperCase();
    const m2 = (costoTotalMoneda || '').trim().toUpperCase();

    if (!tfOk || !ctOk) return null;
    if (!m1 || !m2) return null;
    if (m1 !== m2) return null;

    const calc = tf - ct;
    if (calc < 0) return { value: null, moneda: m1, negativo: true };

    const rounded = Math.round(calc * 10000) / 10000;
    return { value: rounded, moneda: m1, negativo: false };
  }, [totalFacturado, costoTotal, totalFacturadoMoneda, costoTotalMoneda]);

  // Auto-llenado del margen sugerido si no está forzado por el usuario
  useEffect(() => {
    if (margenEsForzado) return;
    if (!margenSugerido) return;
    if (margenSugerido.negativo) return;

    if (margenEstimado === '' || !Number.isFinite(Number(margenEstimado))) {
      setMargenEstimado(String(margenSugerido.value ?? ''));
      setMargenMoneda(margenSugerido.moneda);
    } else {
      setMargenMoneda((prev) => prev || margenSugerido.moneda);
    }
  }, [margenSugerido, margenEsForzado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===================================================================
  //  HANDLERS: formulario base
  // ===================================================================
  const resetForm = () => {
    setSitioId('');
    setResponsableId('');
    setBusquedaResponsable('');
    setResponsableSeleccionado(null);
    setShowListaResponsables(false);

    setNombre('');
    setDescripcion('');

    setFechaInicio('');
    setFechaCierre('');

    setTotalFacturado('');
    setCostoTotal('');

    setMargenEstimado('');
    setMargenEsForzado(false);

    setHitos([]);
    setHitosOpen(false);
  };

  const handleResponsableInputChange = (e) => {
    const value = e.target.value;
    setBusquedaResponsable(value);
    setResponsableId('');
    setResponsableSeleccionado(null);
  };

  const toggleListaResponsables = () => {
    setShowListaResponsables((prev) => !prev);
  };

  const handleSelectResponsable = (usuario) => {
    const nombreU = getNombreUsuario(usuario);
    setResponsableId(String(usuario.id));
    setBusquedaResponsable(nombreU || '');
    setResponsableSeleccionado(usuario);
    setShowListaResponsables(false);
  };

  // ===================================================================
  //  HANDLERS: hitos
  // ===================================================================
  const addHito = () => {
    setHitos((prev) => [
      ...prev,
      {
        _tmpId: makeTmpId(),
        nombre: '',
        descripcion: '',
        target_date: '',
        fecha_realizacion: '',
      },
    ]);
    setHitosOpen(true);
  };

  const removeHito = (tmpId) => {
    setHitos((prev) => prev.filter((h) => h._tmpId !== tmpId));
  };

  const updateHito = (tmpId, patch) => {
    setHitos((prev) => prev.map((h) => (h._tmpId === tmpId ? { ...h, ...patch } : h)));
  };

  const markHitoDoneToday = (tmpId) => {
    updateHito(tmpId, { fecha_realizacion: todayISO() });
  };

  const getEstadoHito = (h) => {
    if (h?.fecha_realizacion) return 'REALIZADO';
    if (h?.target_date && h.target_date < todayISO()) return 'VENCIDO';
    return 'PENDIENTE';
  };

  // ===================================================================
  //  HANDLERS: margen (editable)
  // ===================================================================
  const onChangeMargenEstimado = (v) => {
    setMargenEstimado(v);
    if (v === '') {
      setMargenEsForzado(false);
    } else {
      if (!isNonNegNumberOrEmpty(v)) return;
      setMargenEsForzado(true);
    }
  };

  const usarMargenSugerido = () => {
    if (!margenSugerido || margenSugerido.negativo || margenSugerido.value === null) return;
    setMargenEstimado(String(margenSugerido.value));
    setMargenMoneda(margenSugerido.moneda);
    setMargenEsForzado(false);
  };

  // ===================================================================
  //  SUBMIT
  // ===================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

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

    if (fechaInicio && fechaCierre && fechaCierre < fechaInicio) {
      setError('La fecha de cierre no puede ser menor a la fecha de inicio.');
      return;
    }

    if (!isNonNegNumberOrEmpty(totalFacturado)) {
      setError('Total facturado debe ser un número válido (>= 0).');
      return;
    }
    if (!isNonNegNumberOrEmpty(costoTotal)) {
      setError('Costo del proyecto debe ser un número válido (>= 0).');
      return;
    }
    if (!isNonNegNumberOrEmpty(margenEstimado)) {
      setError('Margen estimado debe ser un número válido (>= 0).');
      return;
    }

    const hitosPayload = (hitos || [])
      .map((h) => ({
        nombre: (h.nombre || '').trim(),
        descripcion: (h.descripcion || '').trim() || null,
        target_date: h.target_date || null,
        fecha_realizacion: h.fecha_realizacion || null,
      }))
      .filter((h) => h.nombre || h.descripcion || h.target_date || h.fecha_realizacion);

    // ✅ OJO: NO mandamos status; en BD queda POR_APROBAR por default
    const payload = {
      responsable_id: Number(responsableId),
      sitio_id: Number(sitioId),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),

      fecha_inicio: fechaInicio || null,
      fecha_cierre: fechaCierre || null,

      total_facturado: totalFacturado === '' ? null : Number(totalFacturado),
      total_facturado_moneda: totalFacturado === '' ? null : (totalFacturadoMoneda || null),

      costo_total: costoTotal === '' ? null : Number(costoTotal),
      costo_total_moneda: costoTotal === '' ? null : (costoTotalMoneda || null),

      margen_estimado: margenEstimado === '' ? null : Number(margenEstimado),
      margen_moneda: margenEstimado === '' ? null : (margenMoneda || null),
      margen_es_forzado: Boolean(margenEsForzado),

      hitos: hitosPayload,
    };

    setSaving(true);
    try {
      await api.post('/api/proyectos', payload);
      setSuccessMsg('Proyecto creado correctamente.');
      resetForm();
    } catch (err) {
      console.error('Error al crear proyecto:', err);
      if (err && err.message) setError(`Error al crear proyecto: ${err.message}`);
      else setError('Ocurrió un error al crear el proyecto. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ===================================================================
  //  RENDER: loading
  // ===================================================================
  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-600">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
        Cargando catálogos...
      </div>
    );
  }

  const renderMonedaOptionLabel = (m) => {
    const codigo = getMonedaCode(m);
    const nombreM = (m?.nombre || m?.name || '').toString().trim();
    if (codigo && nombreM) return `${codigo} — ${nombreM}`;
    return codigo || nombreM || 'Moneda';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Sitio + Cliente */}
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

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
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

        {/* Responsable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Responsable del proyecto <span className="text-red-500">*</span>
          </label>

          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Escribe parte del nombre, correo o departamento..."
              value={busquedaResponsable}
              onChange={handleResponsableInputChange}
            />
            <button
              type="button"
              onClick={toggleListaResponsables}
              className="border border-gray-300 rounded-lg px-2 py-2 bg-white hover:bg-gray-50 flex items-center justify-center"
              title={showListaResponsables ? 'Ocultar lista' : 'Mostrar lista'}
            >
              <span className="text-gray-600 text-xs">{showListaResponsables ? '▲' : '▼'}</span>
            </button>
          </div>

          {showListaResponsables && (
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white text-sm">
              {responsablesFiltrados.length === 0 ? (
                <div className="px-3 py-2 text-gray-400">No se encontraron usuarios que coincidan.</div>
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
                      <span className="font-medium text-gray-800">{nombreU || '(Sin nombre)'}</span>
                      <span className="text-xs text-gray-600">{correoU || 'Sin correo'}</span>
                      <span className="text-xs text-gray-500">{deptoU || 'Sin departamento'}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}

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
                {getDepartamentoUsuario(responsableSeleccionado) || 'Sin departamento'}
              </div>
            </div>
          )}
        </div>

        {/* Nombre + Descripción */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del proyecto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej. Instalación biodigestor Planta Norte..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-gray-400 mt-1">Máx. 100 caracteres.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            placeholder="Describe brevemente el objetivo y alcance..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={400}
          />
          <p className="text-xs text-gray-400 mt-1">Máx. 400 caracteres.</p>
        </div>

        {/* Fechas */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="font-semibold text-gray-800 mb-3">Fechas</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio de actividades</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de cierre</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={fechaCierre}
                min={fechaInicio || undefined}
                onChange={(e) => setFechaCierre(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Finanzas */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="font-semibold text-gray-800 mb-3">Finanzas (opcional)</div>

          {/* ✅ layout más flexible: 1 col -> 2 col -> 3 col */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Total Facturado */}
            <div className="border border-gray-100 rounded-xl p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Total facturado</div>
              <div className="flex flex-col lg:flex-row gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  value={totalFacturado}
                  onChange={(e) => setTotalFacturado(e.target.value)}
                />
                <select
                  className="w-full lg:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={totalFacturadoMoneda}
                  onChange={(e) => setTotalFacturadoMoneda(e.target.value)}
                >
                  {monedas.map((m, idx) => (
                    <option key={(getMonedaCode(m) || idx)} value={getMonedaCode(m)}>
                      {renderMonedaOptionLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Costo del proyecto */}
            <div className="border border-gray-100 rounded-xl p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Costo del proyecto</div>
              <div className="flex flex-col lg:flex-row gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  value={costoTotal}
                  onChange={(e) => setCostoTotal(e.target.value)}
                />
                <select
                  className="w-full lg:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={costoTotalMoneda}
                  onChange={(e) => setCostoTotalMoneda(e.target.value)}
                >
                  {monedas.map((m, idx) => (
                    <option key={(getMonedaCode(m) || idx)} value={getMonedaCode(m)}>
                      {renderMonedaOptionLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Margen estimado */}
            <div className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700">Margen estimado</div>
                {margenSugerido && !margenSugerido.negativo && margenSugerido.value !== null && (
                  <button
                    type="button"
                    onClick={usarMargenSugerido}
                    className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Restaurar al margen sugerido"
                  >
                    Usar sugerido
                  </button>
                )}
              </div>

              <div className="flex flex-col lg:flex-row gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  value={margenEstimado}
                  onChange={(e) => onChangeMargenEstimado(e.target.value)}
                />
                <select
                  className="w-full lg:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={margenMoneda}
                  onChange={(e) => setMargenMoneda(e.target.value)}
                >
                  {monedas.map((m, idx) => (
                    <option key={(getMonedaCode(m) || idx)} value={getMonedaCode(m)}>
                      {renderMonedaOptionLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                {margenSugerido && margenSugerido.negativo && (
                  <span className="text-amber-700">
                    El margen sugerido sería negativo (facturado &lt; costo). Por constraints no se guarda negativo.
                  </span>
                )}
                {margenSugerido && !margenSugerido.negativo && margenSugerido.value !== null && (
                  <span>
                    Sugerido: <span className="font-semibold">{margenSugerido.value}</span> {margenSugerido.moneda}
                    {margenEsForzado ? ' (editado por usuario)' : ''}
                  </span>
                )}
                {!margenSugerido && (
                  <span>Se sugiere automáticamente cuando facturado y costo tienen la misma moneda.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hitos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-800">Hitos (opcional)</div>
            <button
              type="button"
              onClick={addHito}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              + Agregar hito
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHitosOpen((p) => !p)}
            className="mt-3 text-sm text-blue-700 hover:underline"
          >
            {hitosOpen ? 'Ocultar' : 'Mostrar'} hitos ({hitos.length})
          </button>

          {hitosOpen && (
            <div className="mt-4 overflow-x-auto">
              {hitos.length === 0 ? (
                <div className="text-sm text-gray-500">Aún no hay hitos. Puedes agregarlos si lo necesitas.</div>
              ) : (
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Hito *</th>
                      <th className="text-left px-3 py-2 border-b">Descripción</th>
                      <th className="text-left px-3 py-2 border-b">Target date</th>
                      <th className="text-left px-3 py-2 border-b">Fecha realización</th>
                      <th className="text-left px-3 py-2 border-b">Estado</th>
                      <th className="text-right px-3 py-2 border-b">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hitos.map((h) => {
                      const estado = getEstadoHito(h);
                      const badge =
                        estado === 'REALIZADO'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : estado === 'VENCIDO'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-yellow-50 text-yellow-800 border-yellow-200';

                      return (
                        <tr key={h._tmpId} className="border-b last:border-b-0">
                          <td className="px-3 py-2 align-top">
                            <input
                              type="text"
                              className="w-64 border border-gray-300 rounded-lg px-2 py-1"
                              value={h.nombre}
                              onChange={(e) => updateHito(h._tmpId, { nombre: e.target.value })}
                              placeholder="Ej. Kickoff, Entrega parcial..."
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="text"
                              className="w-80 border border-gray-300 rounded-lg px-2 py-1"
                              value={h.descripcion}
                              onChange={(e) => updateHito(h._tmpId, { descripcion: e.target.value })}
                              placeholder="(opcional)"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="date"
                              className="border border-gray-300 rounded-lg px-2 py-1"
                              value={h.target_date}
                              onChange={(e) => updateHito(h._tmpId, { target_date: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                className="border border-gray-300 rounded-lg px-2 py-1"
                                value={h.fecha_realizacion}
                                onChange={(e) => updateHito(h._tmpId, { fecha_realizacion: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => markHitoDoneToday(h._tmpId)}
                                className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
                                title="Marcar como realizado hoy"
                              >
                                Hoy
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${badge}`}>
                              {estado}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <button
                              type="button"
                              onClick={() => removeHito(h._tmpId)}
                              className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Los hitos son opcionales. Si una fila queda completamente vacía, se ignora al guardar.
              </p>
            </div>
          )}
        </div>

        {/* Acciones */}
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
    </div>
  );
}
