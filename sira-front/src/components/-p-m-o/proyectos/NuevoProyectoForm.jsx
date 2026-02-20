// src/components/-p-m-o/proyectos/NuevoProyectoForm.jsx
// Wizard de 4 pasos — toda la lógica idéntica al original.

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Stack, Box, Divider,
} from '@mui/material';

/* ─────────────────────────────────────────────
   UTILIDADES (sin cambios)
───────────────────────────────────────────── */

function extractBlobResponse(resp) {
  if (!resp) return { blob: null, headers: {} };
  if (resp.data instanceof Blob) return { blob: resp.data, headers: resp.headers || {} };
  if (resp instanceof Blob) return { blob: resp, headers: {} };
  if (resp.data && resp.data instanceof ArrayBuffer) {
    return { blob: new Blob([resp.data]), headers: resp.headers || {} };
  }
  return { blob: null, headers: resp.headers || {} };
}

function parseFilenameFromContentDisposition(cd) {
  if (!cd) return null;
  const utf8 = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8?.[1]) { try { return decodeURIComponent(utf8[1]); } catch { return utf8[1]; } }
  const std = cd.match(/filename="(.+?)"/i);
  return std?.[1] ?? null;
}

/* ─────────────────────────────────────────────
   ÍCONOS SVG INLINE
───────────────────────────────────────────── */

function PlusIcon(p) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function TrashIcon(p) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronUpDownIcon(p) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  );
}

function CheckIcon(p) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTES DE DISEÑO
───────────────────────────────────────────── */

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-50';

const disabledCls =
  'w-full rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-400 cursor-not-allowed select-none';

function SectionBadge({ n }) {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
      {n}
    </span>
  );
}

function SectionHeader({ n, title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <SectionBadge n={n} />
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function FieldLabel({ children, required = false, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-xs font-medium text-gray-600">
        {children}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {hint && <span className="text-[11px] tabular-nums text-gray-400">{hint}</span>}
    </div>
  );
}

function Divider2({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-dashed border-gray-200" />
      <span className="text-[11px] font-medium tracking-wide text-gray-400">{label}</span>
      <div className="flex-1 border-t border-dashed border-gray-200" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   WIZARD STEPPER
───────────────────────────────────────────── */

function WizardStepper({ steps, currentStep, onNavigate }) {
  return (
    <div className="flex items-start">
      {steps.map((label, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 flex items-center" style={{ paddingTop: '11px' }}>
                <div className={`h-px w-full ${i <= currentStep ? 'bg-blue-300' : 'bg-gray-200'}`} />
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate(i)}
              className="flex flex-col items-center gap-1 flex-shrink-0 group"
            >
              <span className={`
                inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold transition-all
                ${isDone ? 'bg-blue-600 text-white' : ''}
                ${isActive ? 'bg-blue-600 text-white ring-[3px] ring-blue-100' : ''}
                ${!isDone && !isActive ? 'bg-gray-100 text-gray-400 group-hover:bg-gray-200' : ''}
              `}>
                {isDone ? '✓' : i + 1}
              </span>
              <span className={`text-[10px] font-medium leading-none hidden sm:block whitespace-nowrap
                ${isActive ? 'text-blue-700' : isDone ? 'text-gray-500' : 'text-gray-400'}
              `}>
                {label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */

export default function NuevoProyectoForm({ proyectoId = null, initialValues = null, onSuccess }) {

  /* ── Estado (idéntico al original) ── */
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
  const [status, setStatus] = useState(null);
  const [hitosOpen, setHitosOpen] = useState(true);
  const [hitos, setHitos] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /* ── Wizard state ── */
  const [step, setStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const STEP_LABELS = ['Identidad', 'Finanzas', 'Planificación', 'Hitos'];
  const TOTAL_STEPS = STEP_LABELS.length;
  const isLastStep = step === TOTAL_STEPS - 1;
  const isEditMode = Boolean(proyectoId);

  /* ── Validación del paso 0 (campos obligatorios) ── */
  const step0Valid = Boolean(sitioId && responsableId && nombre.trim() && descripcion.trim());

  /* ── Normalizadores (idénticos) ── */
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

  /* ── Helpers (idénticos) ── */
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

  /* ── Carga inicial (idéntica) ── */
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
        const monedasNorm = normalizarMonedas(monedasRes);
        const monedaMx = monedasNorm.find((x) => getMonedaCode(x) === 'MXN');
        const fallback = monedaMx ? 'MXN' : getMonedaCode(monedasNorm?.[0]) || 'MXN';
        const satSitios = normalizarSitios(sitiosRes);
        const satUsuarios = normalizarUsuarios(usuariosRes);
        setSitios(satSitios);
        setUsuarios(satUsuarios);
        setMonedas(monedasNorm);

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
          if (iv.responsable_id) {
            const u = satUsuarios.find((u) => String(u.id) === String(iv.responsable_id));
            if (u) { setBusquedaResponsable(getNombreUsuario(u)); setResponsableSeleccionado(u); }
          }
          if (Array.isArray(iv.hitos)) {
            setHitos(iv.hitos.map((h) => {
              const respUser = h.responsable_id
                ? satUsuarios.find((u) => String(u.id) === String(h.responsable_id))
                : null;
              return {
                ...h,
                _tmpId: makeTmpId(),
                target_date: h.target_date ? h.target_date.split('T')[0] : '',
                fecha_realizacion: h.fecha_realizacion ? h.fecha_realizacion.split('T')[0] : '',
                responsable_id: h.responsable_id || '',
                _responsableNombre: respUser ? getNombreUsuario(respUser) : '',
              };
            }));
          }
        } else {
          setTotalFacturadoMoneda((p) => p || fallback);
          setCostoTotalMoneda((p) => p || fallback);
          setMargenMoneda((p) => p || fallback);
        }
      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
        setError('No se pudieron cargar los catálogos. Intenta recargar.');
      } finally {
        setLoadingInit(false);
      }
    };
    fetchData();
  }, [initialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Memos (idénticos) ── */
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
      const h = `${getNombreUsuario(u)} ${getCorreoUsuario(u)} ${getDepartamentoUsuario(u)}`.toLowerCase();
      return tokens.every((t) => h.includes(t));
    });
  }, [usuarios, busquedaResponsable]);

  const margenSugerido = useMemo(() => {
    const tf = Number(totalFacturado);
    const ct = Number(costoTotal);
    if (totalFacturado === '' || !Number.isFinite(tf) || costoTotal === '' || !Number.isFinite(ct)) return null;
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
    setMargenMoneda((p) => p || margenSugerido.moneda);
  }, [margenSugerido, margenEsForzado, margenEstimado]);

  /* ── Duración ── */
  const duracionDias = useMemo(() => {
    if (!fechaInicio || !fechaCierre) return null;
    const diff = Math.round((new Date(fechaCierre) - new Date(fechaInicio)) / 86_400_000);
    return diff >= 0 ? diff : null;
  }, [fechaInicio, fechaCierre]);

  /* ── Handlers (idénticos) ── */
  const resetForm = () => {
    setSitioId(''); setResponsableId(''); setBusquedaResponsable('');
    setResponsableSeleccionado(null); setShowListaResponsables(false);
    setNombre(''); setDescripcion(''); setFechaInicio(''); setFechaCierre('');
    setTotalFacturado(''); setCostoTotal(''); setMargenEstimado('');
    setMargenEsForzado(false); setHitos([]); setHitosOpen(true);
    setStep(0); setError(''); setSuccessMsg('');
  };

  const handleResponsableInputChange = (e) => {
    setBusquedaResponsable(e.target.value);
    setResponsableId('');
    setResponsableSeleccionado(null);
  };

  const toggleListaResponsables = () => setShowListaResponsables((p) => !p);

  const handleSelectResponsable = (u) => {
    setResponsableId(String(u.id));
    setBusquedaResponsable(getNombreUsuario(u) || '');
    setResponsableSeleccionado(u);
    setShowListaResponsables(false);
  };

  const addHito = () => {
    setHitos((p) => [...p, { _tmpId: makeTmpId(), nombre: '', descripcion: '', target_date: '', fecha_realizacion: '', responsable_id: '', _responsableNombre: '' }]);
    setHitosOpen(true);
  };
  const removeHito = (id) => setHitos((p) => p.filter((h) => h._tmpId !== id));
  const updateHito = (id, patch) => setHitos((p) => p.map((h) => h._tmpId === id ? { ...h, ...patch } : h));
  const markHitoDoneToday = (id) => updateHito(id, { fecha_realizacion: todayISO() });

  const getEstadoHito = (h) => {
    if (h?.fecha_realizacion) return 'REALIZADO';
    if (h?.target_date && h.target_date < todayISO()) return 'VENCIDO';
    return 'PENDIENTE';
  };

  const onChangeMargenEstimado = (v) => { setMargenEstimado(v); setMargenEsForzado(v !== ''); };
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
    if (!blob) throw new Error('La respuesta del PDF no es válida.');
    const cd = (headers && (headers['content-disposition'] || headers['Content-Disposition'])) ||
      (typeof headers?.get === 'function' ? headers.get('content-disposition') : null);
    const fileName = parseFilenameFromContentDisposition(cd) || `PROY-${pId}.pdf`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.setAttribute('download', fileName);
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  /* ── Submit desacoplado del evento form ── */
  const doSubmit = async () => {
    setError(''); setSuccessMsg('');
    if (Object.values({ sitioId, responsableId, nombre, descripcion }).some((v) => !String(v || '').trim())) {
      setError('Completa los campos obligatorios.'); setStep(0); return;
    }
    if (nombre.trim().length > 100) { setError('El nombre no puede exceder 100 caracteres.'); setStep(0); return; }
    if (descripcion.trim().length > 400) { setError('La descripción no puede exceder 400 caracteres.'); setStep(0); return; }
    if (fechaInicio && fechaCierre && fechaCierre < fechaInicio) {
      setError('La fecha de cierre no puede ser anterior a la de inicio.'); setStep(2); return;
    }
    for (const [key, value] of Object.entries({ totalFacturado, costoTotal })) {
      if (!isNonNegNumberOrEmpty(value)) { setError(`${key} debe ser un número válido (>= 0).`); setStep(1); return; }
    }
    if (margenEstimado !== '' && !Number.isFinite(Number(margenEstimado))) {
      setError('El margen estimado debe ser un número válido.'); setStep(1); return;
    }
    const hitosPayload = (hitos || [])
      .map((h) => ({ id: h.id || undefined, nombre: (h.nombre || '').trim(), descripcion: (h.descripcion || '').trim() || null, target_date: h.target_date || null, fecha_realizacion: h.fecha_realizacion || null, responsable_id: h.responsable_id ? Number(h.responsable_id) : null }))
      .filter((h) => h.nombre || h.descripcion || h.target_date || h.fecha_realizacion);

    const payload = {
      responsable_id: Number(responsableId), sitio_id: Number(sitioId),
      nombre: nombre.trim(), descripcion: descripcion.trim(),
      fecha_inicio: fechaInicio || null, fecha_cierre: fechaCierre || null,
      total_facturado: totalFacturado === '' ? null : Number(totalFacturado),
      total_facturado_moneda: totalFacturado === '' ? null : totalFacturadoMoneda,
      costo_total: costoTotal === '' ? null : Number(costoTotal),
      costo_total_moneda: costoTotal === '' ? null : costoTotalMoneda,
      margen_estimado: margenEstimado === '' ? null : Number(margenEstimado),
      margen_moneda: margenEstimado === '' ? null : margenMoneda,
      margen_es_forzado: Boolean(margenEsForzado),
      hitos: hitosPayload, status,
    };

    setSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/api/proyectos/${proyectoId}`, payload);
        setSuccessMsg('Proyecto actualizado correctamente.');
        if (onSuccess) setTimeout(() => onSuccess(), 1000);
      } else {
        const createResp = await api.post('/api/proyectos', payload);
        const pId = Number(createResp?.proyecto?.id);
        if (Number.isInteger(pId) && pId > 0) {
          let notified = false;
          try { await descargarPdfProyecto(pId, true); notified = true; } catch {
            try { await descargarPdfProyecto(pId, false); } catch (_) { }
          }
          setSuccessMsg(notified
            ? 'Proyecto creado. PDF descargado y notificación enviada.'
            : 'Proyecto creado. PDF descargado.');
          resetForm();
        }
      }
    } catch (err) {
      console.error('Error al guardar proyecto:', err);
      setError(err?.error || err?.message || 'Ocurrió un error al guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Navegación wizard ── */
  const handleNavigate = (i) => {
    setError('');
    setStep(i);
  };

  const handleNext = () => {
    if (step === 0 && !step0Valid) {
      setError('Completa los campos obligatorios antes de continuar.');
      return;
    }
    setError('');
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const handlePrev = () => {
    setError('');
    if (step > 0) setStep((s) => s - 1);
  };

  const handleFinalAction = () => {
    if (!step0Valid) {
      setError('Completa los campos obligatorios en Identidad.');
      setStep(0);
      return;
    }
    if (fechaInicio && fechaCierre && fechaCierre < fechaInicio) {
      setError('La fecha de cierre no puede ser anterior a la de inicio.');
      setStep(2);
      return;
    }
    if (isEditMode) {
      doSubmit();
    } else {
      setConfirmOpen(true);
    }
  };

  /* ── Helper para mostrar montos en el modal ── */
  const fmtMonto = (v, m) =>
    v !== '' && v != null && Number.isFinite(Number(v))
      ? `${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${m}`
      : null;

  /* ── Selector de moneda ── */
  function MonedaSelect({ value, onChange }) {
    return (
      <select
        className="w-[76px] flex-shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {monedas.map((m) => {
          const code = getMonedaCode(m);
          return <option key={code} value={code} title={renderMonedaOptionLabel(m)}>{code}</option>;
        })}
      </select>
    );
  }

  /* ── Loading ── */
  if (loadingInit) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
        <p className="text-sm">Cargando catálogos…</p>
      </div>
    );
  }

  /* ── Badge de estado de hito ── */
  function EstadoBadge({ estado }) {
    const map = {
      REALIZADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      VENCIDO: 'bg-red-50 text-red-600 border-red-200',
      PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[estado] ?? map.PENDIENTE}`}>
        {estado}
      </span>
    );
  }

  /* ── Dot de color para timeline ── */
  function HitoDot({ estado }) {
    const map = { REALIZADO: 'bg-emerald-500', VENCIDO: 'bg-red-400', PENDIENTE: 'bg-amber-400' };
    return (
      <span className={`absolute left-[3px] top-[18px] h-2.5 w-2.5 rounded-full ring-2 ring-white ${map[estado] ?? map.PENDIENTE}`} />
    );
  }

  /* ── Selector de responsable para un hito individual ── */
  function HitoResponsableSelector({ hito, usuarios, getNombreUsuario, getDepartamentoUsuario, onSelect, onClear, inputCls }) {
    const [busqueda, setBusqueda] = React.useState(hito._responsableNombre || '');
    const [showLista, setShowLista] = React.useState(false);

    // Sync búsqueda cuando el hito cambia desde fuera
    React.useEffect(() => {
      setBusqueda(hito._responsableNombre || '');
    }, [hito._responsableNombre]);

    const filtrados = React.useMemo(() => {
      const term = busqueda.trim().toLowerCase();
      if (!term) return usuarios.slice(0, 30);
      const tokens = term.split(/\s+/).filter(Boolean);
      return usuarios.filter((u) => {
        const h = `${getNombreUsuario(u)} ${getDepartamentoUsuario(u)}`.toLowerCase();
        return tokens.every((t) => h.includes(t));
      });
    }, [usuarios, busqueda]);

    const handleSelect = (u) => {
      setBusqueda(getNombreUsuario(u));
      setShowLista(false);
      onSelect(u);
    };

    const handleClear = () => {
      setBusqueda('');
      onClear();
    };

    return (
      <div className="relative mb-2">
        <label className="mb-1 block text-[10px] font-medium text-gray-500">Responsable del hito</label>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <input
              type="text"
              className={`${inputCls} pr-6 text-xs`}
              placeholder="Busca usuario…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); if (!e.target.value) onClear(); }}
              onFocus={() => setShowLista(true)}
              onBlur={() => setTimeout(() => setShowLista(false), 180)}
              autoComplete="off"
            />
            {hito.responsable_id && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
                className="absolute inset-y-0 right-1 flex items-center text-gray-300 hover:text-red-400"
                title="Quitar responsable"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {showLista && (
          <div className="absolute left-0 right-0 top-full z-40 mt-0.5 max-h-44 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5">
            {filtrados.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">Sin resultados</div>
            ) : (
              filtrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
                  className={`flex w-full items-center gap-2.5 border-b border-gray-50 px-3 py-2 text-left last:border-0 transition hover:bg-blue-50/60 ${String(hito.responsable_id) === String(u.id) ? 'bg-blue-50' : ''}`}
                >
                  <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                    {(getNombreUsuario(u) || '?')[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-800">{getNombreUsuario(u)}</p>
                    <p className="truncate text-[10px] text-gray-400">{getDepartamentoUsuario(u) || '—'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── RENDER ── */
  return (
    <div className="space-y-0">
      <style>{`
        .no-spin::-webkit-outer-spin-button,
        .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
      `}</style>

      <form onSubmit={(e) => e.preventDefault()} noValidate>

        {/* ══════════════════════════════════════════════════
            HEADER STICKY
        ══════════════════════════════════════════════════ */}
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-gray-100 bg-white/95 px-4 pt-3 pb-2 backdrop-blur-md">

          {/* Fila 1: título + botones de navegación */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 tracking-wide uppercase">G_PROJ</span>
                <span className="text-gray-300">/</span>
                <h1 className="text-sm font-semibold text-gray-900">
                  {isEditMode ? 'Editar proyecto' : 'Nuevo proyecto'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Limpiar — solo en creación, paso 0 */}
              {!isEditMode && step === 0 && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
                >
                  Limpiar
                </button>
              )}

              {/* Anterior */}
              {step > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
                >
                  ← Anterior
                </button>
              )}

              {/* Siguiente / Acción final */}
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalAction}
                  disabled={saving || !step0Valid}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Guardando…
                    </>
                  ) : (
                    isEditMode ? 'Guardar cambios' : 'Crear proyecto'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Fila 2: stepper */}
          <WizardStepper
            steps={STEP_LABELS}
            currentStep={step}
            onNavigate={handleNavigate}
          />

          {/* Fila 3: mensajes */}
          {(error || successMsg) && (
            <div className="mt-2">
              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  {error}
                </p>
              )}
              {successMsg && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {successMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            PASO 1 — IDENTIDAD
        ══════════════════════════════════════════════════ */}
        {step === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              n="01"
              title="Identidad del proyecto"
              subtitle="Los campos marcados con * son obligatorios."
            />

            {/* Sitio + Cliente */}
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Sitio</FieldLabel>
                <select
                  className={inputCls}
                  value={sitioId}
                  onChange={(e) => setSitioId(e.target.value)}
                >
                  <option value="">Selecciona un sitio…</option>
                  {sitios.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Cliente</FieldLabel>
                <input
                  type="text"
                  className={disabledCls}
                  value={selectedSitio ? (selectedSitio.cliente_nombre || 'Sin cliente') : '—'}
                  disabled
                />
              </div>
            </div>

            {/* Responsable */}
            <div className="relative mb-4">
              <FieldLabel required>Responsable del proyecto</FieldLabel>
              <div className="relative">
                <input
                  type="text"
                  className={`${inputCls} pr-9`}
                  placeholder="Busca por nombre, correo o departamento…"
                  value={busquedaResponsable}
                  onChange={handleResponsableInputChange}
                  onFocus={() => setShowListaResponsables(true)}
                  onBlur={() => setTimeout(() => setShowListaResponsables(false), 180)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={toggleListaResponsables}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 transition hover:text-gray-600"
                >
                  <ChevronUpDownIcon className="h-4 w-4" />
                </button>
              </div>

              {showListaResponsables && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5">
                  {responsablesFiltrados.length === 0 ? (
                    <div className="px-4 py-5 text-center text-xs text-gray-400">
                      No se encontraron usuarios
                    </div>
                  ) : (
                    responsablesFiltrados.map((u) => {
                      const initials = (getNombreUsuario(u) || '?')[0].toUpperCase();
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectResponsable(u)}
                          className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 transition hover:bg-blue-50/60"
                        >
                          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-gray-800">
                              {getNombreUsuario(u) || '(Sin nombre)'}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              {getCorreoUsuario(u) || '—'}
                              {getDepartamentoUsuario(u) ? ` · ${getDepartamentoUsuario(u)}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {responsableSeleccionado && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 py-1 pl-1.5 pr-3">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {(getNombreUsuario(responsableSeleccionado) || '?')[0].toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-blue-800">
                    {getNombreUsuario(responsableSeleccionado)}
                  </span>
                  <CheckIcon className="h-3.5 w-3.5 text-blue-500" />
                </div>
              )}
            </div>

            {/* Nombre */}
            <div className="mb-4">
              <FieldLabel required hint={`${nombre.length}/100`}>
                Nombre del proyecto
              </FieldLabel>
              <input
                type="text"
                className={inputCls}
                placeholder="Ej. Instalación de biodigestor…"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Descripción */}
            <div>
              <FieldLabel required hint={`${descripcion.length}/400`}>
                Descripción
              </FieldLabel>
              <textarea
                className={`${inputCls} min-h-24 resize-none leading-relaxed`}
                placeholder="Objetivo, alcance y resultados esperados del proyecto…"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={400}
              />
            </div>

            {/* Botón avanzar al pie de la sección */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                disabled={!step0Valid || saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PASO 2 — FINANZAS
        ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              n="02"
              title="Finanzas"
              subtitle="Opcional. El margen se calcula cuando facturado y costo usan la misma moneda."
            />

            <div className="space-y-3">
              <div>
                <FieldLabel>Total facturado</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.0001"
                    className={`${inputCls} no-spin flex-1 font-mono`}
                    placeholder="0.00"
                    value={totalFacturado}
                    onChange={(e) => setTotalFacturado(e.target.value)}
                  />
                  <MonedaSelect value={totalFacturadoMoneda} onChange={setTotalFacturadoMoneda} />
                </div>
              </div>

              <Divider2 label="menos" />

              <div>
                <FieldLabel>Costo del proyecto</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.0001"
                    className={`${inputCls} no-spin flex-1 font-mono`}
                    placeholder="0.00"
                    value={costoTotal}
                    onChange={(e) => setCostoTotal(e.target.value)}
                  />
                  <MonedaSelect value={costoTotalMoneda} onChange={setCostoTotalMoneda} />
                </div>
              </div>

              <Divider2 label="= margen" />

              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <FieldLabel>Margen estimado</FieldLabel>
                  {margenSugerido && (
                    <button
                      type="button"
                      onClick={usarMargenSugerido}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      ← Usar sugerido
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    className={`${inputCls} no-spin flex-1 font-mono font-semibold ${margenSugerido?.negativo ? 'text-red-600' : 'text-gray-900'}`}
                    placeholder="0.00"
                    value={margenEstimado}
                    onChange={(e) => onChangeMargenEstimado(e.target.value)}
                  />
                  <MonedaSelect value={margenMoneda} onChange={setMargenMoneda} />
                </div>
                {margenSugerido?.value != null && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    Sugerido:{' '}
                    <span className={`font-semibold ${margenSugerido.negativo ? 'text-red-500' : 'text-gray-700'}`}>
                      {margenSugerido.value} {margenSugerido.moneda}
                    </span>
                    {margenEsForzado && (
                      <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 border border-amber-200">
                        editado
                      </span>
                    )}
                  </p>
                )}
                {!margenSugerido && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    Se calcula automáticamente cuando las monedas coinciden.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <button type="button" onClick={handlePrev} disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
                ← Anterior
              </button>
              <button type="button" onClick={handleNext} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50">
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PASO 3 — PLANIFICACIÓN
        ══════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader n="03" title="Planificación" subtitle="Fechas de inicio y cierre del proyecto." />

            <div className="space-y-3">
              <div>
                <FieldLabel>Fecha de inicio</FieldLabel>
                <input
                  type="date"
                  className={inputCls}
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>Fecha de cierre</FieldLabel>
                <input
                  type="date"
                  className={inputCls}
                  value={fechaCierre}
                  min={fechaInicio || undefined}
                  onChange={(e) => setFechaCierre(e.target.value)}
                />
              </div>

              {duracionDias !== null && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                  <span className="text-xs font-medium text-blue-700">
                    {duracionDias === 0 ? 'Mismo día' : `${duracionDias} día${duracionDias !== 1 ? 's' : ''} de duración`}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-between">
              <button type="button" onClick={handlePrev} disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
                ← Anterior
              </button>
              <button type="button" onClick={handleNext} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50">
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PASO 4 — HITOS
        ══════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              n="04"
              title="Hitos"
              subtitle={hitos.length > 0 ? `${hitos.length} hito${hitos.length !== 1 ? 's' : ''} definido${hitos.length !== 1 ? 's' : ''}` : 'Entregables clave. Opcional.'}
              action={
                <button
                  type="button"
                  onClick={addHito}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Añadir
                </button>
              }
            />

            {hitos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-100 py-8 text-center">
                <p className="text-2xl leading-none mb-2">🏁</p>
                <p className="text-xs text-gray-400">No hay hitos definidos aún.</p>
                <p className="text-[11px] text-gray-300 mt-1">Haz clic en "Añadir" para empezar.</p>
              </div>
            ) : (
              <div>
                {hitos.length > 1 && (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setHitosOpen((p) => !p)}
                      className="text-[11px] font-medium text-gray-400 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-600"
                    >
                      {hitosOpen ? 'Ocultar lista' : 'Mostrar lista'}
                    </button>
                  </div>
                )}

                {hitosOpen && (
                  <div className="relative space-y-0">
                    {hitos.length > 1 && (
                      <div className="absolute left-[7px] top-5 bottom-5 w-px bg-gray-100" />
                    )}

                    {hitos.map((h, i) => {
                      const estado = getEstadoHito(h);
                      return (
                        <div key={h._tmpId} className="relative pl-6 pb-4 last:pb-0">
                          <HitoDot estado={estado} />

                          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            <div className="mb-2.5 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-gray-400 tabular-nums">#{i + 1}</span>
                              <EstadoBadge estado={estado} />
                            </div>

                            <input
                              type="text"
                              className={`${inputCls} mb-2 text-xs`}
                              placeholder="Nombre del hito *"
                              value={h.nombre}
                              onChange={(e) => updateHito(h._tmpId, { nombre: e.target.value })}
                            />

                            <textarea
                              className={`${inputCls} mb-2 min-h-12 resize-none text-xs leading-relaxed`}
                              placeholder="Descripción (opcional)"
                              value={h.descripcion}
                              onChange={(e) => updateHito(h._tmpId, { descripcion: e.target.value })}
                            />

                            {/* Responsable del hito */}
                            <HitoResponsableSelector
                              hito={h}
                              usuarios={usuarios}
                              getNombreUsuario={getNombreUsuario}
                              getDepartamentoUsuario={getDepartamentoUsuario}
                              onSelect={(u) => updateHito(h._tmpId, { responsable_id: String(u.id), _responsableNombre: getNombreUsuario(u) })}
                              onClear={() => updateHito(h._tmpId, { responsable_id: '', _responsableNombre: '' })}
                              inputCls={inputCls}
                            />

                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-medium text-gray-500">Objetivo</label>
                                <input
                                  type="date"
                                  className={`${inputCls} text-xs`}
                                  value={h.target_date}
                                  onChange={(e) => updateHito(h._tmpId, { target_date: e.target.value })}
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-[10px] font-medium text-gray-500">Realizado</label>
                                <div className="flex gap-1">
                                  <input
                                    type="date"
                                    className={`${inputCls} min-w-0 flex-1 text-xs`}
                                    value={h.fecha_realizacion}
                                    onChange={(e) => updateHito(h._tmpId, { fecha_realizacion: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => markHitoDoneToday(h._tmpId)}
                                    title="Marcar como realizado hoy"
                                    className="flex-shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                  >
                                    ✓
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeHito(h._tmpId)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 transition hover:text-red-500"
                              >
                                <TrashIcon className="h-3 w-3" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Navegación final */}
            <div className="mt-5 flex justify-between">
              <button type="button" onClick={handlePrev} disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
                ← Anterior
              </button>
              <button
                type="button"
                onClick={handleFinalAction}
                disabled={saving || !step0Valid}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando…
                  </>
                ) : (
                  isEditMode ? 'Guardar cambios' : 'Crear proyecto'
                )}
              </button>
            </div>
          </div>
        )}

      </form>

      {/* ══════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN (solo creación)
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{
          pb: 1.5,
          backgroundImage: (t) => `linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.03) 65%, #fff 100%)`,
          borderBottom: '1px solid rgba(37,99,235,0.08)',
        }}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1.4, display: 'block' }}>
            G_PROJ / Nuevo proyecto
          </Typography>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Confirmar creación
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Revisa los datos antes de continuar.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 3 }}>
          <Stack spacing={1.5}>
            {[
              ['Nombre', nombre],
              ['Sitio', selectedSitio?.nombre || '—'],
              ['Cliente', selectedSitio ? (selectedSitio.cliente_nombre || 'Sin cliente') : '—'],
              ['Responsable', responsableSeleccionado ? getNombreUsuario(responsableSeleccionado) : '—'],
              fechaInicio ? ['Fecha inicio', fechaInicio] : null,
              fechaCierre ? ['Fecha cierre', fechaCierre] : null,
              fmtMonto(totalFacturado, totalFacturadoMoneda) ? ['Total facturado', fmtMonto(totalFacturado, totalFacturadoMoneda)] : null,
              fmtMonto(costoTotal, costoTotalMoneda) ? ['Costo total', fmtMonto(costoTotal, costoTotalMoneda)] : null,
              fmtMonto(margenEstimado, margenMoneda) ? ['Margen estimado', fmtMonto(margenEstimado, margenMoneda)] : null,
              hitos.length > 0 ? ['Hitos', `${hitos.length} hito${hitos.length !== 1 ? 's' : ''}`] : null,
            ].filter(Boolean).map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, flexShrink: 0 }}>
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(37,99,235,0.05)', borderRadius: 2, border: '1px solid rgba(37,99,235,0.15)' }}>
            <Typography variant="body2" color="primary.main" fontWeight={500}>
              Al confirmar: se creará el proyecto, se descargará el PDF y se enviará una notificación por correo electrónico.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            color="inherit"
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => { setConfirmOpen(false); doSubmit(); }}
            variant="contained"
            disabled={saving}
            sx={{ px: 3 }}
          >
            {saving ? 'Creando…' : 'Confirmar y crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
