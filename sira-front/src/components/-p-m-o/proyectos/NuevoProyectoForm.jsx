// src/components/-p-m-o/proyectos/NuevoProyectoForm.jsx

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100';
const DISABLED_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 shadow-sm cursor-not-allowed';

function extractBlobResponse(resp) {
  if (!resp) return { blob: null, headers: {} };
  if (resp.data instanceof Blob) return { blob: resp.data, headers: resp.headers || {} };
  if (resp instanceof Blob) return { blob: resp, headers: {} };
  if (resp.data && resp.data instanceof ArrayBuffer) {
    return { blob: new Blob([resp.data]), headers: resp.headers || {} };
  }
  return { blob: null, headers: resp.headers || {} };
}

function parseFilenameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const stdMatch = contentDisposition.match(/filename="(.+?)"/i);
  if (stdMatch?.[1]) return stdMatch[1];
  return null;
}

function GlobalStyles() {
  return (
    <style>{`
      .no-spinner::-webkit-outer-spin-button,
      .no-spinner::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .no-spinner {
        -moz-appearance: textfield;
      }
    `}</style>
  );
}

function Section({ title, description, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children} {required ? <span className="text-rose-500">*</span> : null}
    </label>
  );
}

function CurrencyInput({
  label,
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  monedas,
  getMonedaCode,
  renderMonedaOptionLabel,
  suggestion,
  onSuggestionClick,
  isEdited,
  placeholder = '0.0000',
  className = '',
  allowNegative = false,
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {suggestion ? (
          <button
            type="button"
            onClick={onSuggestionClick}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            title="Restaurar al margen sugerido"
          >
            Usar sugerido
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.0001"
          min={allowNegative ? undefined : '0'}
          className={`${INPUT_CLASS} no-spinner px-4 py-3 text-lg font-semibold tracking-wide`}
          placeholder={placeholder}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
        <select
          className={`${INPUT_CLASS} w-[6.75rem] min-w-[6.75rem] px-2.5 py-3 text-sm font-semibold`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
        >
          {monedas.map((m) => {
            const code = getMonedaCode(m);
            return (
              <option key={code} value={code} title={renderMonedaOptionLabel(m)}>
                {code}
              </option>
            );
          })}
        </select>
      </div>

      {suggestion ? (
        <div className="mt-2 min-h-5 text-xs text-slate-500">
          {suggestion.value !== null ? (
            <span>
              Sugerido:{' '}
              <span className={`font-semibold ${suggestion.negativo ? 'text-rose-700' : 'text-slate-700'}`}>
                {suggestion.value} {suggestion.moneda}
              </span>
              {isEdited ? ' (editado)' : ''}
            </span>
          ) : null}
        </div>
      ) : label === 'Margen estimado' ? (
        <div className="mt-2 min-h-5 text-xs text-slate-500">Se calcula automaticamente cuando las monedas coinciden.</div>
      ) : null}
    </div>
  );
}

function PlusIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function TrashIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronUpDownIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  );
}

export default function NuevoProyectoForm({ proyectoId = null, initialValues = null, onSuccess }) {
  const [sitios, setSitios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [sitioId, setSitioId] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [busquedaResponsable, setBusquedaResponsable] = useState('');
  const [responsableSeleccionado, setResponsableSeleccionado] = useState(null);
  const [showListaResponsables, setShowListaResponsables] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [totalFacturado, setTotalFacturado] = useState('');
  const [totalFacturadoMoneda, setTotalFacturadoMoneda] = useState('MXN');
  const [costoTotal, setCostoTotal] = useState('');
  const [costoTotalMoneda, setCostoTotalMoneda] = useState('MXN');
  const [margenEstimado, setMargenEstimado] = useState('');
  const [margenMoneda, setMargenMoneda] = useState('MXN');
  const [margenEsForzado, setMargenEsForzado] = useState(false);
  const [status, setStatus] = useState(null); // For Edit Mode
  const [hitosOpen, setHitosOpen] = useState(true);
  const [hitos, setHitos] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isEditMode = Boolean(proyectoId);

  const normalizarUsuarios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.usuarios)) return raw.usuarios;
    if (Array.isArray(raw?.rows)) return raw.rows;
    return [];
  };

  const normalizarSitios = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.sitios)) return raw.sitios;
    return [];
  };

  const normalizarMonedas = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.monedas)) return raw.monedas;
    if (Array.isArray(raw?.rows)) return raw.rows;
    return [];
  };

  const getNombreUsuario = (u) => u?.nombre_completo || u?.nombre || '';
  const getCorreoUsuario = (u) => u?.correo_google || u?.correo || u?.email || '';
  const getDepartamentoUsuario = (u) => u?.departamento || '';
  const isNonNegNumberOrEmpty = (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const todayISO = () => new Date().toISOString().split('T')[0];
  const makeTmpId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const getMonedaCode = (m) => (m?.codigo || m?.code || '').toString().trim().toUpperCase();
  const renderMonedaOptionLabel = (m) => {
    const code = getMonedaCode(m);
    const name = (m?.nombre || m?.name || '').trim();
    return name ? `${code} - ${name}` : code;
  };

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

        const monedasNormalizadas = normalizarMonedas(monedasRes);
        const monedaMx = monedasNormalizadas.find((x) => getMonedaCode(x) === 'MXN');
        const fallback = monedaMx ? 'MXN' : getMonedaCode(monedasNormalizadas?.[0]) || 'MXN';

        const satSitios = normalizarSitios(sitiosRes);
        const satUsuarios = normalizarUsuarios(usuariosRes);

        setSitios(satSitios);
        setUsuarios(satUsuarios);
        setMonedas(monedasNormalizadas);

        if (initialValues) {
          const iv = initialValues;
          setSitioId(iv.sitio_id || '');
          setResponsableId(iv.responsable_id || '');
          setNombre(iv.nombre || '');
          setDescripcion(iv.descripcion || '');
          setStatus(iv.status || null);
          setFechaInicio(iv.fecha_inicio ? iv.fecha_inicio.split('T')[0] : '');
          setFechaCierre(iv.fecha_cierre ? iv.fecha_cierre.split('T')[0] : '');

          setTotalFacturado(iv.total_facturado ?? '');
          setTotalFacturadoMoneda(iv.total_facturado_moneda || fallback);

          setCostoTotal(iv.costo_total ?? '');
          setCostoTotalMoneda(iv.costo_total_moneda || fallback);

          setMargenEstimado(iv.margen_estimado ?? '');
          setMargenMoneda(iv.margen_moneda || fallback);
          setMargenEsForzado(Boolean(iv.margen_es_forzado));

          // Load Responsible Data for search box
          if (iv.responsable_id) {
            const u = satUsuarios.find(u => String(u.id) === String(iv.responsable_id));
            if (u) {
              setBusquedaResponsable(getNombreUsuario(u));
              setResponsableSeleccionado(u);
            }
          }

          // Hitos
          if (iv.hitos && Array.isArray(iv.hitos)) {
            setHitos(iv.hitos.map(h => ({
              ...h,
              _tmpId: makeTmpId(),
              target_date: h.target_date ? h.target_date.split('T')[0] : '',
              fecha_realizacion: h.fecha_realizacion ? h.fecha_realizacion.split('T')[0] : ''
            })));
          }

        } else {
          setTotalFacturadoMoneda((prev) => prev || fallback);
          setCostoTotalMoneda((prev) => prev || fallback);
          setMargenMoneda((prev) => prev || fallback);
        }

      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
        setError('No se pudieron cargar los catalogos. Intenta recargar.');
      } finally {
        setLoadingInit(false);
      }
    };

    fetchData();
  }, [initialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSitio = useMemo(
    () => sitios.find((s) => String(s.id) === String(sitioId)),
    [sitioId, sitios]
  );

  const responsablesFiltrados = useMemo(() => {
    if (!usuarios.length) return [];

    const term = busquedaResponsable.trim().toLowerCase();
    if (!term) return usuarios;

    const tokens = term.split(/\s+/).filter(Boolean);
    return usuarios.filter((u) => {
      const haystack =
        `${getNombreUsuario(u)} ${getCorreoUsuario(u)} ${getDepartamentoUsuario(u)}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [usuarios, busquedaResponsable]);

  const margenSugerido = useMemo(() => {
    const tf = Number(totalFacturado);
    const ct = Number(costoTotal);

    if (totalFacturado === '' || !Number.isFinite(tf) || costoTotal === '' || !Number.isFinite(ct)) {
      return null;
    }

    const m1 = (totalFacturadoMoneda || '').trim().toUpperCase();
    const m2 = (costoTotalMoneda || '').trim().toUpperCase();
    if (!m1 || !m2 || m1 !== m2) return null;

    const calc = tf - ct;
    return { value: Math.round(calc * 10000) / 10000, moneda: m1, negativo: calc < 0 };
  }, [totalFacturado, costoTotal, totalFacturadoMoneda, costoTotalMoneda]);

  useEffect(() => {
    if (margenEsForzado || !margenSugerido) return;

    if (margenEstimado === '' || !Number.isFinite(Number(margenEstimado))) {
      setMargenEstimado(String(margenSugerido.value ?? ''));
      setMargenMoneda(margenSugerido.moneda);
      return;
    }

    setMargenMoneda((prev) => prev || margenSugerido.moneda);
  }, [margenSugerido, margenEsForzado, margenEstimado]);

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
    setHitosOpen(true);
  };

  const handleResponsableInputChange = (e) => {
    setBusquedaResponsable(e.target.value);
    setResponsableId('');
    setResponsableSeleccionado(null);
  };

  const toggleListaResponsables = () => setShowListaResponsables((prev) => !prev);

  const handleSelectResponsable = (usuario) => {
    setResponsableId(String(usuario.id));
    setBusquedaResponsable(getNombreUsuario(usuario) || '');
    setResponsableSeleccionado(usuario);
    setShowListaResponsables(false);
  };

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

  const onChangeMargenEstimado = (value) => {
    setMargenEstimado(value);
    setMargenEsForzado(value !== '');
  };

  const usarMargenSugerido = () => {
    if (!margenSugerido || margenSugerido.value === null) return;
    setMargenEstimado(String(margenSugerido.value));
    setMargenMoneda(margenSugerido.moneda);
    setMargenEsForzado(false);
  };

  const descargarPdfProyecto = async (pId, notify = true) => {
    const suffix = notify ? '?notify=true' : '';
    const resp = await api.get(`/api/proyectos/${pId}/pdf${suffix}`, { responseType: 'blob' });
    const { blob, headers } = extractBlobResponse(resp);
    if (!blob) throw new Error('La respuesta del PDF no es valida.');

    const contentDisposition =
      (headers && (headers['content-disposition'] || headers['Content-Disposition'])) ||
      (typeof headers?.get === 'function' ? headers.get('content-disposition') : null);

    const fileName = parseFilenameFromContentDisposition(contentDisposition) || `PROY-${pId}.pdf`;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const required = { sitioId, responsableId, nombre, descripcion };
    if (Object.values(required).some((v) => !String(v || '').trim())) {
      setError('Completa los campos obligatorios.');
      return;
    }

    if (nombre.trim().length > 100) {
      setError('El nombre no puede exceder 100 caracteres.');
      return;
    }

    if (descripcion.trim().length > 400) {
      setError('La descripcion no puede exceder 400 caracteres.');
      return;
    }

    if (fechaInicio && fechaCierre && fechaCierre < fechaInicio) {
      setError('La fecha de cierre no puede ser anterior a la fecha de inicio.');
      return;
    }

    const numericFields = { totalFacturado, costoTotal };
    for (const [key, value] of Object.entries(numericFields)) {
      if (!isNonNegNumberOrEmpty(value)) {
        setError(`${key} debe ser un numero valido (>= 0).`);
        return;
      }
    }

    if (margenEstimado !== '' && !Number.isFinite(Number(margenEstimado))) {
      setError('margenEstimado debe ser un numero valido.');
      return;
    }

    const hitosPayload = (hitos || [])
      .map((h) => ({
        id: h.id || undefined, // Include ID if it exists (for updates)
        nombre: (h.nombre || '').trim(),
        descripcion: (h.descripcion || '').trim() || null,
        target_date: h.target_date || null,
        fecha_realizacion: h.fecha_realizacion || null,
      }))
      .filter((h) => Object.values(h).some(Boolean));

    const payload = {
      responsable_id: Number(responsableId),
      sitio_id: Number(sitioId),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha_inicio: fechaInicio || null,
      fecha_cierre: fechaCierre || null,
      total_facturado: totalFacturado === '' ? null : Number(totalFacturado),
      total_facturado_moneda: totalFacturado === '' ? null : totalFacturadoMoneda,
      costo_total: costoTotal === '' ? null : Number(costoTotal),
      costo_total_moneda: costoTotal === '' ? null : costoTotalMoneda,
      margen_estimado: margenEstimado === '' ? null : Number(margenEstimado),
      margen_moneda: margenEstimado === '' ? null : margenMoneda,
      margen_es_forzado: Boolean(margenEsForzado),
      hitos: hitosPayload,
      status: status, // Only relevant if validation allows it on backend (it does)
    };

    setSaving(true);
    try {
      if (isEditMode) {
        // UPDATE
        await api.put(`/api/proyectos/${proyectoId}`, payload);
        setSuccessMsg('Proyecto actualizado correctamente.');
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1000);
        }
      } else {
        // CREATE
        const createResp = await api.post('/api/proyectos', payload);
        const pId = Number(createResp?.proyecto?.id);

        // PDF logic - only on create? or maybe user wants to download it?
        // Logic says: "proyecto creado... PDF descargado". 
        // For update, we might not auto-download PDF.

        if (Number.isInteger(pId) && pId > 0) {
          let notified = false;
          try {
            await descargarPdfProyecto(pId, true);
            notified = true;
          } catch (notifyErr) {
            console.error('No se pudo notificar con PDF:', notifyErr);
            // Fallback download without notify?
            try { await descargarPdfProyecto(pId, false); } catch (_) { }
          }

          if (notified) {
            setSuccessMsg('Proyecto creado correctamente. PDF descargado y notificacion enviada.');
          } else {
            setSuccessMsg('Proyecto creado correctamente. PDF descargado.');
          }
          resetForm();
        }
      }

    } catch (err) {
      console.error('Error al guardar proyecto:', err);
      setError(err?.error || err?.message || 'Ocurrio un error al guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        Cargando...
      </div>
    );
  }

  return (
    <>
      <GlobalStyles />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-cyan-50 p-5 shadow-sm">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-cyan-100/60 blur-2xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {isEditMode ? 'Editar proyecto' : 'Nuevo proyecto'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {isEditMode
                  ? 'Actualiza la información del proyecto y sus hitos.'
                  : 'Captura datos generales, finanzas y planificacion en un flujo rapido y claro.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {!isEditMode && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  Limpiar
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !sitioId || !responsableId || !nombre || !descripcion}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Guardando...
                  </>
                ) : (
                  isEditMode ? 'Guardar cambios' : 'Crear proyecto'
                )}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <strong className="mr-1 font-semibold">Error:</strong>
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Section
              title="Datos generales"
              description="Los campos marcados con * son obligatorios."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel required>Sitio</FieldLabel>
                  <select className={INPUT_CLASS} value={sitioId} onChange={(e) => setSitioId(e.target.value)}>
                    <option value="">Selecciona un sitio...</option>
                    {sitios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Cliente</FieldLabel>
                  <input
                    type="text"
                    className={DISABLED_INPUT_CLASS}
                    value={selectedSitio ? selectedSitio.cliente_nombre || 'Sin cliente' : 'Selecciona un sitio'}
                    disabled
                  />
                </div>
              </div>

              <div className="relative">
                <FieldLabel required>Responsable del proyecto</FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    className={`${INPUT_CLASS} pr-10`}
                    placeholder="Busca por nombre, correo o departamento"
                    value={busquedaResponsable}
                    onChange={handleResponsableInputChange}
                    onFocus={() => setShowListaResponsables(true)}
                    onBlur={() => setTimeout(() => setShowListaResponsables(false), 200)}
                  />
                  <button
                    type="button"
                    onClick={toggleListaResponsables}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
                    title="Abrir lista de responsables"
                  >
                    <ChevronUpDownIcon className="h-5 w-5" />
                  </button>
                </div>

                {showListaResponsables ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {responsablesFiltrados.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500">No se encontraron usuarios.</div>
                    ) : (
                      responsablesFiltrados.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectResponsable(u)}
                          className="flex w-full flex-col border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-sky-50"
                        >
                          <span className="font-medium text-slate-800">{getNombreUsuario(u) || '(Sin nombre)'}</span>
                          <span className="text-xs text-slate-500">{getCorreoUsuario(u) || '(Sin correo)'}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {responsableSeleccionado ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Seleccionado:</span>{' '}
                    {getNombreUsuario(responsableSeleccionado)}
                    {getCorreoUsuario(responsableSeleccionado)
                      ? ` - ${getCorreoUsuario(responsableSeleccionado)}`
                      : ''}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <FieldLabel required>Nombre del proyecto</FieldLabel>
                  <span className="text-xs text-slate-500">{nombre.length}/100</span>
                </div>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="Ej. Instalacion de biodigestor"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <FieldLabel required>Descripcion</FieldLabel>
                  <span className="text-xs text-slate-500">{descripcion.length}/400</span>
                </div>
                <textarea
                  className={`${INPUT_CLASS} min-h-28 resize-y`}
                  placeholder="Objetivo, alcance y resultados esperados"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={400}
                />
              </div>
            </Section>

            <Section
              title="Finanzas"
              description="Opcional. El margen sugerido se calcula como total facturado - costo total."
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CurrencyInput
                  label="Total facturado"
                  amount={totalFacturado}
                  onAmountChange={setTotalFacturado}
                  currency={totalFacturadoMoneda}
                  onCurrencyChange={setTotalFacturadoMoneda}
                  monedas={monedas}
                  getMonedaCode={getMonedaCode}
                  renderMonedaOptionLabel={renderMonedaOptionLabel}
                />

                <CurrencyInput
                  label="Costo del proyecto"
                  amount={costoTotal}
                  onAmountChange={setCostoTotal}
                  currency={costoTotalMoneda}
                  onCurrencyChange={setCostoTotalMoneda}
                  monedas={monedas}
                  getMonedaCode={getMonedaCode}
                  renderMonedaOptionLabel={renderMonedaOptionLabel}
                />

                <CurrencyInput
                  label="Margen estimado"
                  amount={margenEstimado}
                  onAmountChange={onChangeMargenEstimado}
                  currency={margenMoneda}
                  onCurrencyChange={setMargenMoneda}
                  monedas={monedas}
                  getMonedaCode={getMonedaCode}
                  renderMonedaOptionLabel={renderMonedaOptionLabel}
                  suggestion={margenSugerido}
                  onSuggestionClick={usarMargenSugerido}
                  isEdited={margenEsForzado}
                  allowNegative
                  className="lg:col-span-2"
                />
              </div>
            </Section>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <Section
              title="Planificacion"
              description="Fechas para alinear actividades y compromiso de cierre."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Inicio</FieldLabel>
                  <input
                    type="date"
                    className={INPUT_CLASS}
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Cierre</FieldLabel>
                  <input
                    type="date"
                    className={INPUT_CLASS}
                    value={fechaCierre}
                    min={fechaInicio || undefined}
                    onChange={(e) => setFechaCierre(e.target.value)}
                  />
                </div>
              </div>
            </Section>

            <Section
              title="Hitos"
              description="Opcional. Registra entregables clave y su estatus."
              action={
                <button
                  type="button"
                  onClick={addHito}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  <PlusIcon className="h-4 w-4" />
                  Anadir
                </button>
              }
            >
              {hitos.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No hay hitos definidos.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {hitos.length} {hitos.length === 1 ? 'hito' : 'hitos'} en captura.
                    </p>
                    <button
                      type="button"
                      onClick={() => setHitosOpen((prev) => !prev)}
                      className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      {hitosOpen ? 'Ocultar lista' : 'Mostrar lista'}
                    </button>
                  </div>

                  {hitosOpen ? (
                    <div className="space-y-4">
                      {hitos.map((h, index) => {
                        const estado = getEstadoHito(h);
                        const badgeClass =
                          estado === 'REALIZADO'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : estado === 'VENCIDO'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700';

                        return (
                          <article key={h._tmpId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                Hito #{index + 1}
                              </span>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                                {estado}
                              </span>
                            </div>

                            <div className="mt-3 space-y-3">
                              <div>
                                <FieldLabel>Nombre del hito</FieldLabel>
                                <input
                                  type="text"
                                  className={INPUT_CLASS}
                                  value={h.nombre}
                                  onChange={(e) => updateHito(h._tmpId, { nombre: e.target.value })}
                                  placeholder="Ej. Ingenieria de detalle"
                                />
                              </div>

                              <div>
                                <FieldLabel>Descripcion</FieldLabel>
                                <textarea
                                  className={`${INPUT_CLASS} min-h-20 resize-y`}
                                  value={h.descripcion}
                                  onChange={(e) => updateHito(h._tmpId, { descripcion: e.target.value })}
                                  placeholder="Opcional"
                                />
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <FieldLabel>Fecha objetivo</FieldLabel>
                                <input
                                  type="date"
                                  className={INPUT_CLASS}
                                  value={h.target_date}
                                  onChange={(e) => updateHito(h._tmpId, { target_date: e.target.value })}
                                />
                              </div>

                              <div>
                                <FieldLabel>Fecha de realizacion</FieldLabel>
                                <div className="flex gap-2">
                                  <input
                                    type="date"
                                    className={INPUT_CLASS}
                                    value={h.fecha_realizacion}
                                    onChange={(e) => updateHito(h._tmpId, { fecha_realizacion: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => markHitoDoneToday(h._tmpId)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                                    title="Marcar fecha de hoy"
                                  >
                                    Hoy
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeHito(h._tmpId)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                                title="Eliminar hito"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Eliminar
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              )}
            </Section>
          </div>
        </div>
      </form>
    </>
  );
}
