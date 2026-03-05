// src/components/-almacén/ActivoFísico.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

// ── MUI Icons ──────────────────────────────────────────────────────────────────
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BuildIcon from '@mui/icons-material/Build';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreIcon from '@mui/icons-material/Restore';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import HandymanIcon from '@mui/icons-material/Handyman';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TuneIcon from '@mui/icons-material/Tune';
import QrCodeIcon from '@mui/icons-material/QrCode';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import api from '../../api/api';

// ── Constants ──────────────────────────────────────────────────────────────────
const ESTATUS = {
  ACTIVO: { label: 'Activo', pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200', Icon: CheckCircleOutlineIcon },
  EN_MANTENIMIENTO: { label: 'Mantenimiento', pill: 'bg-amber-100 text-amber-700 ring-amber-200', Icon: BuildIcon },
  BAJA: { label: 'Baja', pill: 'bg-red-100 text-red-700 ring-red-200', Icon: BlockIcon },
};

const TIPO_MOV_LABEL = {
  ALTA: 'Alta',
  CAMBIO_RESPONSABLE: 'Cambio de responsable',
  CAMBIO_UBICACION: 'Cambio de ubicación',
  CAMBIO_RESPONSABLE_Y_UBICACION: 'Cambio resp. y ubic.',
  BAJA: 'Baja',
  REACTIVACION: 'Reactivación',
  OTRO: 'Otro',
};

const TIPO_MOV_PILL = {
  ALTA: 'bg-blue-100 text-blue-700',
  CAMBIO_RESPONSABLE: 'bg-purple-100 text-purple-700',
  CAMBIO_UBICACION: 'bg-cyan-100 text-cyan-700',
  CAMBIO_RESPONSABLE_Y_UBICACION: 'bg-indigo-100 text-indigo-700',
  BAJA: 'bg-red-100 text-red-700',
  REACTIVACION: 'bg-emerald-100 text-emerald-700',
  OTRO: 'bg-slate-100 text-slate-600',
};

const MONEDAS = ['MXN', 'USD', 'EUR'];

const EXCEL_TEMPLATE_COLS = [
  'nombre', 'categoria_clave', 'tipo_clave', 'marca', 'modelo',
  'numero_serie', 'codigo', 'fecha_compra', 'costo_compra', 'moneda', 'detalle_tecnico',
];

const EMPTY_FORM_ACTIVO = {
  nombre: '', categoria_id: '', tipo_id: '', marca: '', modelo: '',
  numero_serie: '', codigo: '', detalle_tecnico: '',
  fecha_compra: '', costo_compra: '', moneda: 'MXN', proveedor_id: '',
  // alta inicial
  empleado_responsable_nuevo_id: '', ubicacion_nueva_id: '', observaciones_alta: '',
};

// ── Shared micro-components ────────────────────────────────────────────────────
function StatusBadge({ estatus }) {
  const cfg = ESTATUS[estatus] ?? { label: estatus, pill: 'bg-slate-100 text-slate-600 ring-slate-200', Icon: null };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.pill}`}>
      {Icon && <Icon sx={{ fontSize: 12 }} />}
      {cfg.label}
    </span>
  );
}

function TipoMovBadge({ tipo }) {
  const label = TIPO_MOV_LABEL[tipo] ?? tipo;
  const pill = TIPO_MOV_PILL[tipo] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pill}`}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function Modal({ open, onClose, title, children, wide = false, extraWide = false }) {
  if (!open) return null;
  const sizeClass = extraWide ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClass} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <CloseIcon sx={{ fontSize: 20 }} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  );
}

const iCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400 bg-white';
const sCls = iCls;

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        <Icon sx={{ fontSize: 22 }} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'inventario',  label: 'Inventario',   Icon: InventoryIcon },
  { id: 'movimientos', label: 'Movimientos',  Icon: ReceiptLongIcon },
  { id: 'carga_masiva', label: 'Carga masiva', Icon: CloudUploadIcon },
  { id: 'catalogos',   label: 'Catálogos',    Icon: TuneIcon },
  { id: 'pendientes',  label: 'Pendientes',   Icon: PersonIcon, badge: true },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ActivoFísico() {
  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('inventario');
  const [catalogTab, setCatalogTab] = useState('categorias');

  // ── Shared catalogs ──────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  // ── Inventario state ─────────────────────────────────────────────────────────
  const [activos, setActivos] = useState([]);
  const [activosLoading, setActivosLoading] = useState(false);
  const [activosError, setActivosError] = useState('');
  const [filters, setFilters] = useState({ search: '', categoria_id: '', estatus: '', ubicacion_id: '' });

  // Modal: nuevo / editar activo
  const [modalActivo, setModalActivo] = useState({ open: false, activo: null });
  const [formActivo, setFormActivo] = useState(EMPTY_FORM_ACTIVO);
  const [savingActivo, setSavingActivo] = useState(false);
  const [errorActivo, setErrorActivo] = useState('');

  // Modal: registrar movimiento
  const [modalMov, setModalMov] = useState({ open: false, activo: null, tipo: '' });
  const [formMov, setFormMov] = useState({ empleado_responsable_nuevo_id: '', ubicacion_nueva_id: '', observaciones: '' });
  const [savingMov, setSavingMov] = useState(false);
  const [errorMov, setErrorMov] = useState('');

  // Modal: historial de movimientos
  const [modalHist, setModalHist] = useState({ open: false, activo: null });
  const [historial, setHistorial] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // ── Movimientos tab state ─────────────────────────────────────────────────────
  const [movimientos, setMovimientos] = useState([]);
  const [movLoading, setMovLoading] = useState(false);
  const [movFilters, setMovFilters] = useState({ search: '', tipo_movimiento: '', desde: '', hasta: '' });

  // ── Carga masiva state ───────────────────────────────────────────────────────
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkUnresolved, setBulkUnresolved] = useState({ categorias: [], tipos: [] }); // claves no encontradas
  const [bulkMappings, setBulkMappings] = useState({}); // { 'CLAVE_DESCONOCIDA': 'CLAVE_VALIDA' }
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // ── Catálogos state ──────────────────────────────────────────────────────────
  const [modalCat, setModalCat] = useState({ open: false, tipo: '', item: null });
  const [formCat, setFormCat] = useState({});
  const [savingCat, setSavingCat] = useState(false);
  const [errorCat, setErrorCat] = useState('');

  // ── Pendientes de asignación ──────────────────────────────────────────────────
  const [pendientesCount, setPendientesCount] = useState(0);
  const [pendientes, setPendientes] = useState([]);
  const [pendLoading, setPendLoading] = useState(false);
  // { [activoId]: { modo: 'SOLO_ASIGNAR'|'ASIGNAR_Y_ENTREGAR', empleado_id, ubicacion_id } }
  const [pendAsig, setPendAsig] = useState({});
  const [pendSaving, setPendSaving] = useState({});   // { [activoId]: bool }

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCatalogos();
    fetchPendientesCount();
  }, []);

  useEffect(() => {
    if (activeTab === 'inventario')  fetchActivos();
    if (activeTab === 'movimientos') fetchMovimientos();
    if (activeTab === 'pendientes')  fetchPendientes();
  }, [activeTab]);

  // ── API: Shared ──────────────────────────────────────────────────────────────
  const fetchCatalogos = async () => {
    try {
      const [cats, tips, ubics, emps, provs] = await Promise.all([
        api.get('/api/activos-fisicos/categorias').catch(() => []),
        api.get('/api/activos-fisicos/tipos').catch(() => []),
        api.get('/api/activos-fisicos/ubicaciones').catch(() => []),
        api.get('/api/empleados/list').catch(() => []),
        api.get('/api/proveedores/list').catch(() => []),
      ]);
      setCategorias(Array.isArray(cats) ? cats : []);
      setTipos(Array.isArray(tips) ? tips : []);
      setUbicaciones(Array.isArray(ubics) ? ubics : []);
      setEmpleados(Array.isArray(emps) ? emps : []);
      setProveedores(Array.isArray(provs) ? provs : []);
    } catch (err) {
      console.error('fetchCatalogos:', err);
    }
  };

  // ── API: Inventario ──────────────────────────────────────────────────────────
  const fetchActivos = async (f = filters) => {
    setActivosLoading(true);
    setActivosError('');
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) params.append(k, v); });
      const data = await api.get(`/api/activos-fisicos${params.toString() ? `?${params}` : ''}`);
      setActivos(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setActivosError('No se pudo cargar el inventario de activos físicos.');
    } finally {
      setActivosLoading(false);
    }
  };

  const fetchPendientesCount = async () => {
    try {
      const data = await api.get('/api/activos-fisicos/pendientes/count');
      setPendientesCount(data?.total ?? 0);
    } catch { /* silencioso */ }
  };

  const fetchPendientes = async () => {
    setPendLoading(true);
    try {
      const data = await api.get('/api/activos-fisicos/pendientes');
      const lista = Array.isArray(data) ? data : [];
      setPendientes(lista);
      setPendAsig(prev => {
        const next = { ...prev };
        lista.forEach(a => {
          if (!next[a.id]) next[a.id] = { modo: 'SOLO_ASIGNAR', empleado_id: '', ubicacion_id: '' };
        });
        return next;
      });
    } catch (err) {
      console.error('fetchPendientes error:', err);
    } finally {
      setPendLoading(false);
    }
  };

  const handleGuardarAsigPend = async (activo) => {
    const asig = pendAsig[activo.id];
    if (!asig?.empleado_id) return;
    setPendSaving(prev => ({ ...prev, [activo.id]: true }));
    try {
      await api.post(`/api/activos-fisicos/${activo.id}/movimientos`, {
        tipo_movimiento: 'ALTA',
        empleado_responsable_nuevo_id: parseInt(asig.empleado_id, 10),
        ubicacion_nueva_id: asig.modo === 'ASIGNAR_Y_ENTREGAR' && asig.ubicacion_id
          ? parseInt(asig.ubicacion_id, 10) : null,
      });
      await Promise.all([fetchPendientes(), fetchPendientesCount()]);
    } catch (err) {
      alert(err?.error || 'Error al registrar la asignación.');
    } finally {
      setPendSaving(prev => ({ ...prev, [activo.id]: false }));
    }
  };

  const handleSubmitActivo = async (e) => {
    e.preventDefault();
    if (!formActivo.nombre?.trim() || !formActivo.categoria_id || !formActivo.tipo_id) {
      setErrorActivo('Nombre, categoría y tipo son obligatorios.');
      return;
    }
    setSavingActivo(true);
    setErrorActivo('');
    try {
      const payload = {
        nombre: formActivo.nombre.trim(),
        categoria_id: Number(formActivo.categoria_id),
        tipo_id: Number(formActivo.tipo_id),
        marca: formActivo.marca || null,
        modelo: formActivo.modelo || null,
        numero_serie: formActivo.numero_serie || null,
        codigo: formActivo.codigo || null,
        detalle_tecnico: formActivo.detalle_tecnico || null,
        fecha_compra: formActivo.fecha_compra || null,
        costo_compra: formActivo.costo_compra ? Number(formActivo.costo_compra) : null,
        moneda: formActivo.moneda || null,
        proveedor_id: formActivo.proveedor_id ? Number(formActivo.proveedor_id) : null,
        // Alta inicial (solo en creación)
        ...(!modalActivo.activo && {
          empleado_responsable_nuevo_id: formActivo.empleado_responsable_nuevo_id ? Number(formActivo.empleado_responsable_nuevo_id) : null,
          ubicacion_nueva_id: formActivo.ubicacion_nueva_id ? Number(formActivo.ubicacion_nueva_id) : null,
          observaciones_alta: formActivo.observaciones_alta || null,
        }),
      };
      if (modalActivo.activo?.id) {
        await api.put(`/api/activos-fisicos/${modalActivo.activo.id}`, payload);
      } else {
        await api.post('/api/activos-fisicos', payload);
      }
      setModalActivo({ open: false, activo: null });
      fetchActivos(filters);
    } catch (err) {
      setErrorActivo(err?.error || err?.message || 'Error al guardar el activo.');
    } finally {
      setSavingActivo(false);
    }
  };

  const handleSubmitMov = async (e) => {
    e.preventDefault();
    setSavingMov(true);
    setErrorMov('');
    try {
      const needsResp = ['CAMBIO_RESPONSABLE', 'CAMBIO_RESPONSABLE_Y_UBICACION', 'ALTA'].includes(modalMov.tipo);
      const needsUbic = ['CAMBIO_UBICACION', 'CAMBIO_RESPONSABLE_Y_UBICACION', 'ALTA'].includes(modalMov.tipo);

      if (needsResp && !formMov.empleado_responsable_nuevo_id) {
        setErrorMov('Debe seleccionar el nuevo responsable.');
        setSavingMov(false);
        return;
      }
      if (needsUbic && !formMov.ubicacion_nueva_id) {
        setErrorMov('Debe seleccionar la nueva ubicación.');
        setSavingMov(false);
        return;
      }

      await api.post(`/api/activos-fisicos/${modalMov.activo.id}/movimientos`, {
        tipo_movimiento: modalMov.tipo,
        empleado_responsable_nuevo_id: formMov.empleado_responsable_nuevo_id ? Number(formMov.empleado_responsable_nuevo_id) : null,
        ubicacion_nueva_id: formMov.ubicacion_nueva_id ? Number(formMov.ubicacion_nueva_id) : null,
        observaciones: formMov.observaciones || null,
      });
      setModalMov({ open: false, activo: null, tipo: '' });
      fetchActivos(filters);
    } catch (err) {
      setErrorMov(err?.error || err?.message || 'Error al registrar el movimiento.');
    } finally {
      setSavingMov(false);
    }
  };

  const openHistorial = async (activo) => {
    setModalHist({ open: true, activo });
    setHistorial([]);
    setHistLoading(true);
    try {
      const data = await api.get(`/api/activos-fisicos/${activo.id}/movimientos`);
      setHistorial(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setHistorial([]);
    } finally {
      setHistLoading(false);
    }
  };

  // ── API: Movimientos tab ─────────────────────────────────────────────────────
  const fetchMovimientos = async (f = movFilters) => {
    setMovLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) params.append(k, v); });
      const data = await api.get(`/api/activos-fisicos/movimientos${params.toString() ? `?${params}` : ''}`);
      setMovimientos(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setMovimientos([]);
    } finally {
      setMovLoading(false);
    }
  };

  // ── Excel: Carga masiva ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    // Hoja 1: Plantilla de datos
    const ws1 = XLSX.utils.aoa_to_sheet([
      EXCEL_TEMPLATE_COLS,
      ['Silla Ergonómica', categorias[0]?.clave || 'MOBIL', tipos[0]?.clave || 'SILLA', 'OfficeMax', 'Modelo Pro X', 'SN-00001', 'ACT-001', '2024-01-15', '2500.00', 'MXN', 'Color negro, altura ajustable'],
      ['Laptop Dell', categorias[1]?.clave || 'TI', tipos[1]?.clave || 'LAPTOP', 'Dell', 'Latitude 5540', 'SN-LP-001', 'ACT-002', '2024-03-10', '35000.00', 'MXN', 'Intel i7, 16GB RAM, 512GB SSD'],
    ]);
    ws1['!cols'] = EXCEL_TEMPLATE_COLS.map(() => ({ wch: 18 }));

    // Hoja 2: Referencia de claves válidas (generada con catálogos actuales)
    const refRows = [
      ['=== CATEGORÍAS VÁLIDAS ===', '', '=== TIPOS VÁLIDOS ===', '', ''],
      ['categoria_clave', 'nombre_categoría', 'tipo_clave', 'categoría_padre', 'nombre_tipo'],
    ];
    const maxLen = Math.max(categorias.length, tipos.length);
    for (let i = 0; i < maxLen; i++) {
      const cat = categorias[i];
      const tip = tipos[i];
      refRows.push([
        cat?.clave || '', cat?.nombre || '',
        tip?.clave || '', categorias.find(c => c.id === tip?.categoria_id)?.clave || '', tip?.nombre || '',
      ]);
    }
    if (ubicaciones.length > 0) {
      refRows.push([''], ['=== UBICACIONES (referencia) ===', '']);
      refRows.push(['ubicacion_clave', 'nombre']);
      ubicaciones.forEach(u => refRows.push([u.clave, u.nombre]));
    }
    const ws2 = XLSX.utils.aoa_to_sheet(refRows);
    ws2['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Activos');
    XLSX.utils.book_append_sheet(wb, ws2, 'Referencia_Claves');
    XLSX.writeFile(wb, 'plantilla_activos_fisicos.xlsx');
  };

  const parseExcelFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]]; // Siempre leer hoja 1
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const [headers, ...dataRows] = rows;
        const missing = EXCEL_TEMPLATE_COLS.filter(c => !(headers ?? []).includes(c));
        if (missing.length > 0) {
          setBulkErrors([`Columnas faltantes en el archivo: ${missing.join(', ')}`]);
          setBulkRows([]);
          return;
        }
        const parsed = dataRows
          .filter(r => r.some(v => String(v).trim() !== ''))
          .map(r => Object.fromEntries(EXCEL_TEMPLATE_COLS.map(c => [c, r[headers.indexOf(c)] ?? ''])));

        // Detectar claves no reconocidas
        const catClaves = new Set(categorias.map(c => c.clave.toUpperCase()));
        const tipClaves = new Set(tipos.map(t => t.clave.toUpperCase()));
        const unknownCats = [...new Set(
          parsed.map(r => String(r.categoria_clave ?? '').trim().toUpperCase()).filter(k => k && !catClaves.has(k))
        )];
        const unknownTips = [...new Set(
          parsed.map(r => String(r.tipo_clave ?? '').trim().toUpperCase()).filter(k => k && !tipClaves.has(k))
        )];

        setBulkRows(parsed);
        setBulkErrors([]);
        setBulkUnresolved({ categorias: unknownCats, tipos: unknownTips });
        setBulkMappings({});
      } catch {
        setBulkErrors(['No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx).']);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const hasUnresolved = bulkUnresolved.categorias.length > 0 || bulkUnresolved.tipos.length > 0;

  const resolveBulkRows = () => {
    // Aplica mappings sobre las filas antes de enviar
    return bulkRows.map(row => {
      const catKey = String(row.categoria_clave ?? '').trim().toUpperCase();
      const tipKey = String(row.tipo_clave ?? '').trim().toUpperCase();
      return {
        ...row,
        categoria_clave: bulkMappings[catKey] ?? row.categoria_clave,
        tipo_clave: bulkMappings[tipKey] ?? row.tipo_clave,
      };
    });
  };

  const handleBulkSubmit = async () => {
    if (!bulkRows.length) return;
    // Verificar que todas las claves desconocidas han sido mapeadas
    const unmapped = [
      ...bulkUnresolved.categorias.filter(k => !bulkMappings[k]),
      ...bulkUnresolved.tipos.filter(k => !bulkMappings[k]),
    ];
    if (unmapped.length > 0) {
      setBulkErrors([`Debes resolver las referencias pendientes antes de importar: ${unmapped.join(', ')}`]);
      return;
    }
    setUploading(true);
    setBulkErrors([]);
    try {
      const items = resolveBulkRows();
      await api.post('/api/activos-fisicos/bulk', { items });
      setBulkRows([]);
      setBulkErrors([]);
      setBulkUnresolved({ categorias: [], tipos: [] });
      setBulkMappings({});
      setActiveTab('inventario');
      fetchActivos({ search: '', categoria_id: '', estatus: '', ubicacion_id: '' });
    } catch (err) {
      const detail = err?.errores ? err.errores.join('\n') : (err?.error || err?.message || 'Error al importar.');
      setBulkErrors([detail]);
    } finally {
      setUploading(false);
    }
  };

  // ── API: Catálogos CRUD ──────────────────────────────────────────────────────
  const handleSubmitCat = async (e) => {
    e.preventDefault();
    setSavingCat(true);
    setErrorCat('');
    const { tipo, item } = modalCat;
    try {
      const payload = { ...formCat };
      if (tipo === 'tipos') payload.categoria_id = Number(payload.categoria_id);
      if (payload.activo !== undefined) payload.activo = payload.activo === true || payload.activo === 'true';

      if (item?.id) {
        await api.put(`/api/activos-fisicos/${tipo}/${item.id}`, payload);
      } else {
        await api.post(`/api/activos-fisicos/${tipo}`, payload);
      }
      setModalCat({ open: false, tipo: '', item: null });
      fetchCatalogos();
    } catch (err) {
      setErrorCat(err?.error || err?.message || 'Error al guardar.');
    } finally {
      setSavingCat(false);
    }
  };

  const openCatModal = (tipo, item = null) => {
    setModalCat({ open: true, tipo, item });
    if (item) {
      setFormCat({ ...item });
    } else {
      const defaults = { clave: '', nombre: '', descripcion: '', activo: true };
      if (tipo === 'tipos') defaults.categoria_id = '';
      if (tipo === 'ubicaciones') defaults.parent_id = '';
      setFormCat(defaults);
    }
    setErrorCat('');
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const tiposFiltradosPorCat = useMemo(
    () => tipos.filter(t => !formActivo.categoria_id || String(t.categoria_id) === String(formActivo.categoria_id)),
    [tipos, formActivo.categoria_id]
  );

  const kpis = useMemo(() => ({
    total: activos.length,
    activos: activos.filter(a => a.estatus === 'ACTIVO').length,
    mantenimiento: activos.filter(a => a.estatus === 'EN_MANTENIMIENTO').length,
    baja: activos.filter(a => a.estatus === 'BAJA').length,
  }), [activos]);

  const openMovModal = (activo, tipo) => {
    setModalMov({ open: true, activo, tipo });
    setFormMov({ empleado_responsable_nuevo_id: '', ubicacion_nueva_id: '', observaciones: '' });
    setErrorMov('');
  };

  const openActivoModal = (activo = null) => {
    setModalActivo({ open: true, activo });
    setFormActivo(activo ? {
      nombre: activo.nombre || '',
      categoria_id: activo.categoria_id || '',
      tipo_id: activo.tipo_id || '',
      marca: activo.marca || '',
      modelo: activo.modelo || '',
      numero_serie: activo.numero_serie || '',
      codigo: activo.codigo || '',
      detalle_tecnico: activo.detalle_tecnico || '',
      fecha_compra: activo.fecha_compra?.slice(0, 10) || '',
      costo_compra: activo.costo_compra ?? '',
      moneda: activo.moneda?.trim() || 'MXN',
      proveedor_id: activo.proveedor_id || '',
    } : { ...EMPTY_FORM_ACTIVO });
    setErrorActivo('');
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Almacén</p>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <HandymanIcon sx={{ fontSize: 30 }} className="text-blue-600" />
            Activo Físico
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Control, trazabilidad y movimientos de activos físicos.</p>
        </div>
        {activeTab === 'inventario' && (
          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 self-start lg:self-auto"
            onClick={() => openActivoModal()}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            Nuevo activo
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="px-6 border-b border-slate-200 bg-white">
        <nav className="flex gap-1">
          {TABS.map(({ id, label, Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon sx={{ fontSize: 17 }} />
              {label}
              {badge && pendientesCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                  {pendientesCount > 99 ? '99+' : pendientesCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* ════════════════════ TAB: INVENTARIO ════════════════════ */}
        {activeTab === 'inventario' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={InventoryIcon} label="Total registrados" value={kpis.total} color="bg-blue-100 text-blue-600" />
              <KpiCard icon={CheckCircleOutlineIcon} label="Activos" value={kpis.activos} color="bg-emerald-100 text-emerald-600" />
              <KpiCard icon={BuildIcon} label="En mantenimiento" value={kpis.mantenimiento} color="bg-amber-100 text-amber-600" />
              <KpiCard icon={BlockIcon} label="Dados de baja" value={kpis.baja} color="bg-red-100 text-red-600" />
            </div>

            {/* Filtros */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4 text-slate-700">
                <FilterListIcon sx={{ fontSize: 20 }} />
                <h3 className="text-base font-semibold">Filtros</h3>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); fetchActivos(filters); }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm bg-white">
                  <SearchIcon sx={{ fontSize: 17, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="SKU, nombre, serie..."
                    value={filters.search}
                    onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={filters.categoria_id}
                  onChange={e => setFilters(p => ({ ...p, categoria_id: e.target.value }))}
                  className={sCls}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select
                  value={filters.estatus}
                  onChange={e => setFilters(p => ({ ...p, estatus: e.target.value }))}
                  className={sCls}
                >
                  <option value="">Todos los estatus</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="EN_MANTENIMIENTO">En mantenimiento</option>
                  <option value="BAJA">Baja</option>
                </select>
                <select
                  value={filters.ubicacion_id}
                  onChange={e => setFilters(p => ({ ...p, ubicacion_id: e.target.value }))}
                  className={sCls}
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { const f = { search: '', categoria_id: '', estatus: '', ubicacion_id: '' }; setFilters(f); fetchActivos(f); }}
                    className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  >
                    Buscar
                  </button>
                </div>
              </form>
            </section>

            {/* Tabla */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {activosError && (
                <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{activosError}</div>
              )}
              {activosLoading ? <Spinner /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['SKU', 'Nombre', 'Categoría / Tipo', 'Marca / Modelo', 'Responsable', 'Ubicación', 'Estatus', 'Acciones'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activos.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-slate-400 py-12">
                            <InventoryIcon sx={{ fontSize: 40 }} className="mb-2 block mx-auto opacity-30" />
                            No se encontraron activos físicos
                          </td>
                        </tr>
                      ) : activos.map(a => (
                        <ActivoRow
                          key={a.id}
                          activo={a}
                          onEdit={() => openActivoModal(a)}
                          onMovimiento={(tipo) => openMovModal(a, tipo)}
                          onHistorial={() => openHistorial(a)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ════════════════════ TAB: MOVIMIENTOS ════════════════════ */}
        {activeTab === 'movimientos' && (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4 text-slate-700">
                <FilterListIcon sx={{ fontSize: 20 }} />
                <h3 className="text-base font-semibold">Filtrar movimientos</h3>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); fetchMovimientos(movFilters); }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm bg-white">
                  <SearchIcon sx={{ fontSize: 17, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="SKU, nombre de activo..."
                    value={movFilters.search}
                    onChange={e => setMovFilters(p => ({ ...p, search: e.target.value }))}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={movFilters.tipo_movimiento}
                  onChange={e => setMovFilters(p => ({ ...p, tipo_movimiento: e.target.value }))}
                  className={sCls}
                >
                  <option value="">Todos los tipos</option>
                  {Object.entries(TIPO_MOV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="date" value={movFilters.desde} onChange={e => setMovFilters(p => ({ ...p, desde: e.target.value }))} className={iCls} placeholder="Desde" />
                <input type="date" value={movFilters.hasta} onChange={e => setMovFilters(p => ({ ...p, hasta: e.target.value }))} className={iCls} placeholder="Hasta" />
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { const f = { search: '', tipo_movimiento: '', desde: '', hasta: '' }; setMovFilters(f); fetchMovimientos(f); }}
                    className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                  <button type="submit" className="px-5 py-2 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">Buscar</button>
                </div>
              </form>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {movLoading ? <Spinner /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['#', 'Activo (SKU)', 'Tipo de movimiento', 'Responsable anterior', 'Responsable nuevo', 'Ubicación anterior', 'Ubicación nueva', 'Fecha', 'Estado'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movimientos.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-slate-400 py-12">No hay movimientos registrados</td></tr>
                      ) : movimientos.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs">{m.consecutivo}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{m.sku || m.activo_sku}</span>
                            <p className="text-xs text-slate-500 mt-0.5">{m.activo_nombre}</p>
                          </td>
                          <td className="px-4 py-3"><TipoMovBadge tipo={m.tipo_movimiento} /></td>
                          <td className="px-4 py-3 text-xs text-slate-600">{m.responsable_anterior || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{m.responsable_nuevo || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{m.ubicacion_anterior || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{m.ubicacion_nueva || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.estado === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                              {m.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ════════════════════ TAB: CARGA MASIVA ════════════════════ */}
        {activeTab === 'carga_masiva' && (
          <div className="max-w-4xl space-y-6">
            {/* Instrucciones */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-4">
              <div className="shrink-0 text-blue-500 mt-0.5"><UploadFileIcon sx={{ fontSize: 28 }} /></div>
              <div>
                <h3 className="font-semibold text-blue-900 text-base mb-1">Carga masiva de activos</h3>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Descarga la plantilla Excel haciendo clic en el botón de abajo.</li>
                  <li>Completa las filas con los datos de tus activos. Las claves de categoría y tipo deben existir en el catálogo.</li>
                  <li>Sube el archivo completado; revisa la vista previa y confirma la importación.</li>
                </ol>
              </div>
            </div>

            {/* Descarga de plantilla */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-800">Plantilla Excel</p>
                <p className="text-xs text-slate-500 mt-0.5">Columnas: {EXCEL_TEMPLATE_COLS.join(', ')}</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
                Descargar plantilla
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 text-center transition-colors cursor-pointer ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); parseExcelFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 44 }} className="text-blue-400" />
              <div>
                <p className="font-semibold text-slate-700">Arrastra tu archivo aquí</p>
                <p className="text-sm text-slate-500">o haz clic para seleccionarlo</p>
              </div>
              <p className="text-xs text-slate-400">Formatos aceptados: .xlsx, .xls</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => parseExcelFile(e.target.files[0])}
              />
            </div>

            {/* Errores de parse */}
            {bulkErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="font-semibold text-red-700 text-sm mb-1">Errores encontrados:</p>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                  {bulkErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* Resolver referencias no encontradas */}
            {hasUnresolved && bulkRows.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <WarningAmberIcon sx={{ fontSize: 22 }} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900">Referencias no reconocidas</p>
                    <p className="text-sm text-amber-700 mt-0.5">Las siguientes claves del archivo no coinciden con ningún catálogo activo. Asígnalas a un registro existente para continuar.</p>
                  </div>
                </div>

                {bulkUnresolved.categorias.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Categorías desconocidas</p>
                    {bulkUnresolved.categorias.map(clave => (
                      <div key={clave} className="flex items-center gap-3">
                        <span className="font-mono text-sm bg-white border border-amber-300 px-2 py-1 rounded-lg text-amber-900 min-w-[120px]">{clave}</span>
                        <span className="text-slate-500 text-sm">→</span>
                        <select
                          className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={bulkMappings[clave] || ''}
                          onChange={e => setBulkMappings(p => ({ ...p, [clave]: e.target.value }))}
                        >
                          <option value="">— Seleccionar categoría —</option>
                          {categorias.map(c => <option key={c.id} value={c.clave}>{c.clave} — {c.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {bulkUnresolved.tipos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tipos desconocidos</p>
                    {bulkUnresolved.tipos.map(clave => (
                      <div key={clave} className="flex items-center gap-3">
                        <span className="font-mono text-sm bg-white border border-amber-300 px-2 py-1 rounded-lg text-amber-900 min-w-[120px]">{clave}</span>
                        <span className="text-slate-500 text-sm">→</span>
                        <select
                          className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={bulkMappings[clave] || ''}
                          onChange={e => setBulkMappings(p => ({ ...p, [clave]: e.target.value }))}
                        >
                          <option value="">— Seleccionar tipo —</option>
                          {tipos.map(t => <option key={t.id} value={t.clave}>{t.categoria_clave ? `[${t.categoria_clave}] ` : ''}{t.clave} — {t.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vista previa */}
            {bulkRows.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Vista previa</p>
                    <p className="text-xs text-slate-500">{bulkRows.length} {bulkRows.length === 1 ? 'registro' : 'registros'} detectados</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setBulkRows([]); setBulkErrors([]);
                        setBulkUnresolved({ categorias: [], tipos: [] }); setBulkMappings({});
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleBulkSubmit}
                      disabled={uploading || (hasUnresolved && bulkUnresolved.categorias.some(k => !bulkMappings[k]) || bulkUnresolved.tipos.some(k => !bulkMappings[k]))}
                      className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      title={hasUnresolved ? 'Resuelve todas las referencias antes de importar' : ''}
                    >
                      {uploading ? 'Importando...' : `Confirmar importación (${bulkRows.length})`}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-500 font-semibold">#</th>
                        {EXCEL_TEMPLATE_COLS.map(c => (
                          <th key={c} className="px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          {EXCEL_TEMPLATE_COLS.map(c => (
                            <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[150px] truncate">{String(row[c] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ TAB: CATÁLOGOS ════════════════════ */}
        {activeTab === 'catalogos' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'categorias', label: 'Categorías', Icon: CategoryIcon },
                { id: 'tipos', label: 'Tipos', Icon: TuneIcon },
                { id: 'ubicaciones', label: 'Ubicaciones', Icon: LocationOnIcon },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setCatalogTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    catalogTab === id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon sx={{ fontSize: 16 }} />
                  {label}
                </button>
              ))}
            </div>

            {/* Categorías */}
            {catalogTab === 'categorias' && (
              <CatalogSection
                title="Categorías de activo"
                items={categorias}
                columns={['Clave', 'Nombre', 'Descripción', 'Estado']}
                renderRow={c => [
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{c.clave}</span>,
                  c.nombre,
                  <span className="text-slate-500">{c.descripcion || '—'}</span>,
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>,
                ]}
                onNew={() => openCatModal('categorias')}
                onEdit={c => openCatModal('categorias', c)}
              />
            )}

            {/* Tipos */}
            {catalogTab === 'tipos' && (
              <CatalogSection
                title="Tipos de activo"
                items={tipos}
                columns={['Clave', 'Nombre', 'Categoría', 'Descripción', 'Estado']}
                renderRow={t => [
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{t.clave}</span>,
                  t.nombre,
                  <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{categorias.find(c => c.id === t.categoria_id)?.nombre || t.categoria_id}</span>,
                  <span className="text-slate-500">{t.descripcion || '—'}</span>,
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.activo ? 'Activo' : 'Inactivo'}</span>,
                ]}
                onNew={() => openCatModal('tipos')}
                onEdit={t => openCatModal('tipos', t)}
              />
            )}

            {/* Ubicaciones */}
            {catalogTab === 'ubicaciones' && (
              <CatalogSection
                title="Ubicaciones"
                items={ubicaciones}
                columns={['Clave', 'Nombre', 'Padre', 'Descripción', 'Estado']}
                renderRow={u => [
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{u.clave}</span>,
                  u.nombre,
                  <span className="text-slate-500 text-xs">{ubicaciones.find(p => p.id === u.parent_id)?.nombre || '—'}</span>,
                  <span className="text-slate-500">{u.descripcion || '—'}</span>,
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>,
                ]}
                onNew={() => openCatModal('ubicaciones')}
                onEdit={u => openCatModal('ubicaciones', u)}
              />
            )}
          </div>
        )}

        {/* ════════════════════ TAB: PENDIENTES ════════════════════ */}
        {activeTab === 'pendientes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Activos pendientes de asignación</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Activos ingresados al sistema sin responsable asignado. Asígnalos aquí o desde ING_OC.
                </p>
              </div>
              <button
                onClick={fetchPendientes}
                className="text-xs text-blue-600 hover:underline"
              >
                Actualizar
              </button>
            </div>

            {pendLoading ? (
              <div className="text-center py-10 text-slate-400">Cargando pendientes…</div>
            ) : pendientes.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CheckCircleOutlineIcon sx={{ fontSize: 48, mb: 1, color: '#86efac' }} />
                <p className="text-sm font-medium text-emerald-600">¡Sin pendientes! Todos los activos tienen responsable asignado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">SKU</th>
                      <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold">Categoría / Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold">Ingresado</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ minWidth: 160 }}>Acción</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ minWidth: 200 }}>Responsable</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ minWidth: 180 }}>Ubicación destino</th>
                      <th className="px-4 py-3 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendientes.map(activo => {
                      const asig = pendAsig[activo.id] || { modo: 'SOLO_ASIGNAR', empleado_id: '', ubicacion_id: '' };
                      const saving = pendSaving[activo.id] === true;
                      return (
                        <tr key={activo.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{activo.sku}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{activo.nombre}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {activo.categoria_nombre}<br />{activo.tipo_nombre}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {activo.creado_en ? new Date(activo.creado_en).toLocaleDateString('es-MX') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={asig.modo}
                              onChange={e => setPendAsig(prev => ({ ...prev, [activo.id]: { ...asig, modo: e.target.value } }))}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              <option value="SOLO_ASIGNAR">Solo asignar responsable</option>
                              <option value="ASIGNAR_Y_ENTREGAR">Asignar y entregar</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={asig.empleado_id}
                              onChange={e => setPendAsig(prev => ({ ...prev, [activo.id]: { ...asig, empleado_id: e.target.value } }))}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              <option value="">Selecciona empleado...</option>
                              {empleados.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.nombre_completo || `${emp.nombre} ${emp.apellido_paterno}`}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {asig.modo === 'ASIGNAR_Y_ENTREGAR' ? (
                              <select
                                value={asig.ubicacion_id}
                                onChange={e => setPendAsig(prev => ({ ...prev, [activo.id]: { ...asig, ubicacion_id: e.target.value } }))}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              >
                                <option value="">Selecciona ubicación...</option>
                                {ubicaciones.map(u => (
                                  <option key={u.id} value={u.id}>{u.nombre}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400">No aplica</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleGuardarAsigPend(activo)}
                              disabled={!asig.empleado_id || saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {saving ? (
                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                              )}
                              Asignar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════ MODAL: NUEVO / EDITAR ACTIVO ════════════════ */}
      <Modal
        open={modalActivo.open}
        onClose={() => { if (!savingActivo) setModalActivo({ open: false, activo: null }); }}
        title={modalActivo.activo ? `Editar activo — ${modalActivo.activo.sku}` : 'Registrar nuevo activo'}
        wide
      >
        <form onSubmit={handleSubmitActivo} className="space-y-6">
          {/* Sección: Identificación */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Identificación</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre del activo" required>
                <input className={iCls} value={formActivo.nombre} onChange={e => setFormActivo(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Silla ergonómica" required />
              </Field>
              <Field label="Código interno">
                <input className={iCls} value={formActivo.codigo} onChange={e => setFormActivo(p => ({ ...p, codigo: e.target.value }))} placeholder="Ej. ACT-001" />
              </Field>
              <Field label="Categoría" required>
                <select
                  className={sCls}
                  value={formActivo.categoria_id}
                  onChange={e => setFormActivo(p => ({ ...p, categoria_id: e.target.value, tipo_id: '' }))}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.clave})</option>)}
                </select>
              </Field>
              <Field label="Tipo" required>
                <select
                  className={sCls}
                  value={formActivo.tipo_id}
                  onChange={e => setFormActivo(p => ({ ...p, tipo_id: e.target.value }))}
                  required
                  disabled={!formActivo.categoria_id}
                >
                  <option value="">Seleccionar tipo</option>
                  {tiposFiltradosPorCat.filter(t => t.activo).map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.clave})</option>)}
                </select>
              </Field>
            </div>
          </fieldset>

          {/* Sección: Características */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Características</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Marca">
                <input className={iCls} value={formActivo.marca} onChange={e => setFormActivo(p => ({ ...p, marca: e.target.value }))} placeholder="Ej. Dell" />
              </Field>
              <Field label="Modelo">
                <input className={iCls} value={formActivo.modelo} onChange={e => setFormActivo(p => ({ ...p, modelo: e.target.value }))} placeholder="Ej. Latitude 5540" />
              </Field>
              <Field label="Número de serie" hint="Debe ser único si se captura">
                <input className={iCls} value={formActivo.numero_serie} onChange={e => setFormActivo(p => ({ ...p, numero_serie: e.target.value }))} placeholder="Ej. SN-0001" />
              </Field>
            </div>
            <Field label="Detalle técnico">
              <textarea className={iCls} rows={2} value={formActivo.detalle_tecnico} onChange={e => setFormActivo(p => ({ ...p, detalle_tecnico: e.target.value }))} placeholder="Especificaciones técnicas relevantes..." />
            </Field>
          </fieldset>

          {/* Sección: Compra */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Datos de adquisición</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Fecha de compra">
                <input type="date" className={iCls} value={formActivo.fecha_compra} onChange={e => setFormActivo(p => ({ ...p, fecha_compra: e.target.value }))} />
              </Field>
              <Field label="Costo de compra">
                <input type="number" step="0.01" min="0" className={iCls} value={formActivo.costo_compra} onChange={e => setFormActivo(p => ({ ...p, costo_compra: e.target.value }))} placeholder="0.00" />
              </Field>
              <Field label="Moneda">
                <select className={sCls} value={formActivo.moneda} onChange={e => setFormActivo(p => ({ ...p, moneda: e.target.value }))}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Proveedor">
                  <select className={sCls} value={formActivo.proveedor_id} onChange={e => setFormActivo(p => ({ ...p, proveedor_id: e.target.value }))}>
                    <option value="">Sin proveedor asignado</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.marca} — {p.razon_social}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Sección: Alta inicial (solo en creación) */}
          {!modalActivo.activo && (
            <fieldset className="space-y-4 bg-blue-50/60 border border-blue-100 rounded-xl p-4">
              <legend className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">Alta inicial (asignación)</legend>
              <p className="text-xs text-blue-700">Opcional. Si no se asigna ahora, puedes hacerlo después desde Acciones → Registrar alta.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Responsable inicial">
                  <select className={sCls} value={formActivo.empleado_responsable_nuevo_id} onChange={e => setFormActivo(p => ({ ...p, empleado_responsable_nuevo_id: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo || `${e.nombre} ${e.apellido_paterno}`}</option>)}
                  </select>
                </Field>
                <Field label="Ubicación inicial">
                  <select className={sCls} value={formActivo.ubicacion_nueva_id} onChange={e => setFormActivo(p => ({ ...p, ubicacion_nueva_id: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {ubicaciones.filter(u => u.activo).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Observaciones de alta">
                    <input className={iCls} value={formActivo.observaciones_alta} onChange={e => setFormActivo(p => ({ ...p, observaciones_alta: e.target.value }))} placeholder="Observaciones del movimiento de alta..." />
                  </Field>
                </div>
              </div>
            </fieldset>
          )}

          {errorActivo && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{errorActivo}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalActivo({ open: false, activo: null })} disabled={savingActivo} className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={savingActivo} className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {savingActivo ? 'Guardando...' : modalActivo.activo ? 'Guardar cambios' : 'Registrar activo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ════════════════ MODAL: REGISTRAR MOVIMIENTO ════════════════ */}
      <Modal
        open={modalMov.open}
        onClose={() => { if (!savingMov) setModalMov({ open: false, activo: null, tipo: '' }); }}
        title={movModalTitle(modalMov.tipo)}
      >
        {modalMov.activo && (
          <div className="space-y-5">
            {/* Info del activo */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
              <QrCodeIcon sx={{ fontSize: 24 }} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-sm font-semibold text-slate-700">{modalMov.activo.sku}</p>
                <p className="text-sm text-slate-600">{modalMov.activo.nombre}</p>
                <StatusBadge estatus={modalMov.activo.estatus} />
              </div>
            </div>

            <form onSubmit={handleSubmitMov} className="space-y-4">
              {/* Nuevo responsable */}
              {['ALTA', 'CAMBIO_RESPONSABLE', 'CAMBIO_RESPONSABLE_Y_UBICACION'].includes(modalMov.tipo) && (
                <Field label="Nuevo responsable" required>
                  <select className={sCls} value={formMov.empleado_responsable_nuevo_id} onChange={e => setFormMov(p => ({ ...p, empleado_responsable_nuevo_id: e.target.value }))} required>
                    <option value="">Seleccionar empleado</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo || `${e.nombre} ${e.apellido_paterno}`}</option>)}
                  </select>
                </Field>
              )}

              {/* Nueva ubicación */}
              {['ALTA', 'CAMBIO_UBICACION', 'CAMBIO_RESPONSABLE_Y_UBICACION'].includes(modalMov.tipo) && (
                <Field label="Nueva ubicación" required>
                  <select className={sCls} value={formMov.ubicacion_nueva_id} onChange={e => setFormMov(p => ({ ...p, ubicacion_nueva_id: e.target.value }))} required>
                    <option value="">Seleccionar ubicación</option>
                    {ubicaciones.filter(u => u.activo).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </Field>
              )}

              {/* Tipo de movimiento (OTRO seleccionable) */}
              {modalMov.tipo === 'OTRO' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  Este movimiento se registrará como <strong>"Otro"</strong> sin cambio de responsable ni ubicación.
                </div>
              )}

              {/* Info para BAJA / REACTIVACION */}
              {modalMov.tipo === 'BAJA' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                  El activo quedará en estatus <strong>Baja</strong>. Solo se podrá reactivar con un movimiento de Reactivación.
                </div>
              )}
              {modalMov.tipo === 'REACTIVACION' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  El activo volverá a estatus <strong>Activo</strong>.
                </div>
              )}

              <Field label="Observaciones">
                <textarea className={iCls} rows={3} value={formMov.observaciones} onChange={e => setFormMov(p => ({ ...p, observaciones: e.target.value }))} placeholder="Motivo, notas, referencias de folio..." />
              </Field>

              {errorMov && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{errorMov}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setModalMov({ open: false, activo: null, tipo: '' })} disabled={savingMov} className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingMov} className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {savingMov ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* ════════════════ MODAL: HISTORIAL ════════════════ */}
      <Modal
        open={modalHist.open}
        onClose={() => setModalHist({ open: false, activo: null })}
        title={`Historial — ${modalHist.activo?.sku || ''}`}
        wide
      >
        {histLoading ? <Spinner /> : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{historial.length} movimiento(s) registrados para <strong>{modalHist.activo?.nombre}</strong></p>
            {historial.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Sin movimientos aún.</div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {historial.map((m, i) => (
                  <div key={m.id} className="bg-slate-50 rounded-xl p-4 flex gap-4 items-start">
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{m.consecutivo}</span>
                      {i < historial.length - 1 && <div className="w-px flex-1 bg-slate-200 min-h-[12px]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <TipoMovBadge tipo={m.tipo_movimiento} />
                        {m.estado === 'ANULADO' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">ANULADO</span>}
                        <span className="text-xs text-slate-400">{m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-600">
                        {m.responsable_anterior !== undefined && <p><span className="text-slate-400">Resp. anterior:</span> {m.responsable_anterior || '—'}</p>}
                        {m.responsable_nuevo !== undefined && <p><span className="text-slate-400">Resp. nuevo:</span> {m.responsable_nuevo || '—'}</p>}
                        {m.ubicacion_anterior !== undefined && <p><span className="text-slate-400">Ubic. anterior:</span> {m.ubicacion_anterior || '—'}</p>}
                        {m.ubicacion_nueva !== undefined && <p><span className="text-slate-400">Ubic. nueva:</span> {m.ubicacion_nueva || '—'}</p>}
                      </div>
                      {m.observaciones && <p className="text-xs text-slate-500 mt-1 italic">{m.observaciones}</p>}
                      {m.motivo_anulacion && <p className="text-xs text-red-600 mt-1">Motivo de anulación: {m.motivo_anulacion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ════════════════ MODAL: CATÁLOGOS ════════════════ */}
      <Modal
        open={modalCat.open}
        onClose={() => { if (!savingCat) setModalCat({ open: false, tipo: '', item: null }); }}
        title={`${modalCat.item ? 'Editar' : 'Nueva'} ${catTipoLabel(modalCat.tipo)}`}
      >
        <form onSubmit={handleSubmitCat} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Clave" required>
              <input className={iCls} value={formCat.clave || ''} onChange={e => setFormCat(p => ({ ...p, clave: e.target.value.toUpperCase() }))} placeholder="Ej. MOBIL" required maxLength={30} />
            </Field>
            <Field label="Nombre" required>
              <input className={iCls} value={formCat.nombre || ''} onChange={e => setFormCat(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre descriptivo" required maxLength={150} />
            </Field>
          </div>

          {/* Categoría padre (para tipos) */}
          {modalCat.tipo === 'tipos' && (
            <Field label="Categoría" required>
              <select className={sCls} value={formCat.categoria_id || ''} onChange={e => setFormCat(p => ({ ...p, categoria_id: e.target.value }))} required>
                <option value="">Seleccionar categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.clave})</option>)}
              </select>
            </Field>
          )}

          {/* Ubicación padre (para ubicaciones) */}
          {modalCat.tipo === 'ubicaciones' && (
            <Field label="Ubicación padre">
              <select className={sCls} value={formCat.parent_id || ''} onChange={e => setFormCat(p => ({ ...p, parent_id: e.target.value || null }))}>
                <option value="">Sin padre (nivel raíz)</option>
                {ubicaciones.filter(u => u.id !== modalCat.item?.id).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Field>
          )}

          <Field label="Descripción">
            <textarea className={iCls} rows={2} value={formCat.descripcion || ''} onChange={e => setFormCat(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional..." />
          </Field>

          <div className="flex items-center gap-2">
            <input
              id="cat-activo"
              type="checkbox"
              checked={formCat.activo ?? true}
              onChange={e => setFormCat(p => ({ ...p, activo: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
            />
            <label htmlFor="cat-activo" className="text-sm text-slate-700">Activo (visible en selects)</label>
          </div>

          {errorCat && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{errorCat}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setModalCat({ open: false, tipo: '', item: null })} disabled={savingCat} className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={savingCat} className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {savingCat ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Helper: row de activo con menú de acciones ─────────────────────────────────
function ActivoRow({ activo, onEdit, onMovimiento, onHistorial }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isBaja = activo.estatus === 'BAJA';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{activo.sku}</span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800 text-sm leading-snug">{activo.nombre}</p>
        {activo.codigo && <p className="text-xs text-slate-400">{activo.codigo}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>{activo.categoria_nombre || activo.categoria_id}</p>
        <p className="text-slate-400">{activo.tipo_nombre || activo.tipo_id}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>{activo.marca || '—'}</p>
        <p className="text-slate-400">{activo.modelo || ''}</p>
      </td>
      <td className="px-4 py-3 text-xs">
        {activo.responsable_nombre ? (
          <span className="flex items-center gap-1 text-slate-700">
            <PersonIcon sx={{ fontSize: 14 }} className="text-slate-400" />
            {activo.responsable_nombre}
          </span>
        ) : <span className="text-slate-400">Sin asignar</span>}
      </td>
      <td className="px-4 py-3 text-xs">
        {activo.ubicacion_nombre ? (
          <span className="flex items-center gap-1 text-slate-700">
            <LocationOnIcon sx={{ fontSize: 14 }} className="text-slate-400" />
            {activo.ubicacion_nombre}
          </span>
        ) : <span className="text-slate-400">Sin ubicación</span>}
      </td>
      <td className="px-4 py-3">
        <StatusBadge estatus={activo.estatus} />
      </td>
      <td className="px-4 py-3 relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
        >
          <ExpandMoreIcon sx={{ fontSize: 18 }} />
        </button>

        {menuOpen && (
          <div className="absolute right-2 top-12 z-30 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 w-52" onClick={() => setMenuOpen(false)}>
            <button onClick={onEdit} className="menu-item">
              <EditIcon sx={{ fontSize: 16 }} className="text-slate-400" />
              Editar datos
            </button>

            {!isBaja && !activo.empleado_responsable_actual_id && !activo.ubicacion_actual_id && (
              <button onClick={() => onMovimiento('ALTA')} className="menu-item">
                <CheckCircleOutlineIcon sx={{ fontSize: 16 }} className="text-blue-500" />
                Registrar alta
              </button>
            )}

            {!isBaja && (
              <>
                <button onClick={() => onMovimiento('CAMBIO_RESPONSABLE')} className="menu-item">
                  <PersonIcon sx={{ fontSize: 16 }} className="text-purple-500" />
                  Cambiar responsable
                </button>
                <button onClick={() => onMovimiento('CAMBIO_UBICACION')} className="menu-item">
                  <LocationOnIcon sx={{ fontSize: 16 }} className="text-cyan-500" />
                  Cambiar ubicación
                </button>
                <button onClick={() => onMovimiento('CAMBIO_RESPONSABLE_Y_UBICACION')} className="menu-item">
                  <SwapHorizIcon sx={{ fontSize: 16 }} className="text-indigo-500" />
                  Cambiar resp. y ubic.
                </button>
                <button onClick={() => onMovimiento('OTRO')} className="menu-item">
                  <BuildIcon sx={{ fontSize: 16 }} className="text-amber-500" />
                  Registrar mantenimiento
                </button>
                <div className="h-px bg-slate-100 my-1 mx-3" />
                <button onClick={() => onMovimiento('BAJA')} className="menu-item text-red-600 hover:bg-red-50">
                  <DeleteForeverIcon sx={{ fontSize: 16 }} />
                  Dar de baja
                </button>
              </>
            )}

            {isBaja && (
              <button onClick={() => onMovimiento('REACTIVACION')} className="menu-item text-emerald-700 hover:bg-emerald-50">
                <RestoreIcon sx={{ fontSize: 16 }} />
                Reactivar
              </button>
            )}

            <div className="h-px bg-slate-100 my-1 mx-3" />
            <button onClick={onHistorial} className="menu-item">
              <HistoryIcon sx={{ fontSize: 16 }} className="text-slate-400" />
              Ver historial
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── CatalogSection ─────────────────────────────────────────────────────────────
function CatalogSection({ title, items, columns, renderRow, onNew, onEdit }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{items.length} registros</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <AddIcon sx={{ fontSize: 16 }} />
          Nuevo
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(c => (
                <th key={c} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{c}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center text-slate-400 py-10 text-sm">Sin registros aún</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                {renderRow(item).map((cell, i) => (
                  <td key={i} className="px-4 py-3 text-slate-700">{cell}</td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────────
function movModalTitle(tipo) {
  const map = {
    ALTA: 'Registrar alta del activo',
    CAMBIO_RESPONSABLE: 'Cambiar responsable',
    CAMBIO_UBICACION: 'Cambiar ubicación',
    CAMBIO_RESPONSABLE_Y_UBICACION: 'Cambiar responsable y ubicación',
    BAJA: 'Dar de baja el activo',
    REACTIVACION: 'Reactivar activo',
    OTRO: 'Registrar movimiento / mantenimiento',
  };
  return map[tipo] ?? 'Registrar movimiento';
}

function catTipoLabel(tipo) {
  return { categorias: 'categoría', tipos: 'tipo', ubicaciones: 'ubicación' }[tipo] ?? tipo;
}
