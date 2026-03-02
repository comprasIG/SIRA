//D:\SIRA\SIRA\sira-front\src\components\AgregarProductoForm.jsx
// --- MODIFICADO --- Se añade funcionalidad de carga masiva desde Excel con botón de plantilla
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import StyleIcon from '@mui/icons-material/Style';
import DescriptionIcon from '@mui/icons-material/Description';
import ScaleIcon from '@mui/icons-material/Scale';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import UploadIcon from '@mui/icons-material/Upload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";

// --- LECTURA DE LA VARIABLE DE ENTORNO ---
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!import.meta.env.VITE_API_URL) {
  console.warn("ADVERTENCIA: VITE_API_URL no está definida en tu archivo .env. Usando http://localhost:3001 como respaldo.");
}

// --- ESTILOS MEJORADOS CON COLORES SUAVIZADOS ---
const inputStyle =
  "mt-2 block w-full border border-gray-200 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 sm:text-sm transition-all duration-300 read-only:bg-gray-50 read-only:border-gray-300 read-only:text-gray-600";

const labelStyle = "block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2";

// --- ESTADO INICIAL ---
const initialState = {
  tipo: "",
  categoria: "",
  detalle: "",
  sku: "",
  unidad_de_compra: "",
  activo: true,
  cantidad_uso: "",
  unidad_uso_id: "",
};

const AgregarProductoForm = () => {
  const [formData, setFormData] = useState(initialState);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);
  const [validandoSku, setValidandoSku] = useState(false);
  const [skuDisponible, setSkuDisponible] = useState(null);
  const [productosExistentes, setProductosExistentes] = useState([]);

  // modo: 'individual' | 'masiva' | 'unidades'
  const [modo, setModo] = useState('individual');

  // Estados para carga masiva
  const [archivoCargado, setArchivoCargado] = useState(null);
  const [productosCargados, setProductosCargados] = useState([]);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [cargandoMasivamente, setCargandoMasivamente] = useState(false);

  // Estados para gestión de unidades
  const [editandoUnidadId, setEditandoUnidadId] = useState(null);
  const [editandoUnidadDatos, setEditandoUnidadDatos] = useState({ unidad: '', simbolo: '' });
  const [nuevaUnidad, setNuevaUnidad] = useState({ unidad: '', simbolo: '' });
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);

  // --- Cargar unidades ---
  const fetchUnidades = useCallback(async () => {
    const resp = await axios.get(`${API_BASE_URL}/api/catalogo_unidades`);
    setUnidades(resp.data);
  }, []);

  // --- useEffect para cargar las unidades y productos existentes ---
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setCargandoUnidades(true);
        const [respuestaUnidades, respuestaProductos] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/catalogo_unidades`),
          axios.get(`${API_BASE_URL}/api/catalogo_materiales`)
        ]);

        setUnidades(respuestaUnidades.data);
        setProductosExistentes(respuestaProductos.data);
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        toast.error("Error: No se pudieron cargar los datos iniciales.");
      } finally {
        setCargandoUnidades(false);
      }
    };

    cargarDatosIniciales();
  }, []);

  // --- Generación de nombre ---
  const nombreGenerado = [formData.tipo, formData.categoria, formData.detalle]
    .filter(Boolean)
    .join(" ");

  // --- Validación de SKU en tiempo real ---
  useEffect(() => {
    const validarSku = async () => {
      if (!formData.sku || formData.sku.length < 2) {
        setSkuDisponible(null);
        return;
      }

      setValidandoSku(true);

      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const skuExistente = productosExistentes.find(
          producto => producto.sku.toUpperCase() === formData.sku.toUpperCase()
        );

        if (skuExistente) {
          setSkuDisponible(false);
        } else {
          const respuesta = await axios.get(`${API_BASE_URL}/api/catalogo_materiales?sku=${formData.sku}`);
          const existeEnServidor = respuesta.data.some(
            producto => producto.sku.toUpperCase() === formData.sku.toUpperCase()
          );
          setSkuDisponible(!existeEnServidor);
        }
      } catch (error) {
        console.error("Error al validar SKU:", error);
        setSkuDisponible(false);
      } finally {
        setValidandoSku(false);
      }
    };

    validarSku();
  }, [formData.sku, productosExistentes]);

  // --- Descargar plantilla Excel ---
  const descargarPlantilla = () => {
    try {
      const plantillaData = [
        { 'SKU': 'AC.CS05', 'Tipo': 'CODO',        'Categoría': 'INOX SOLD',   'Detalle': '4 x 90°', 'Unidad': 'PIEZA', 'Cant. Uso': '', 'Unidad Uso': '' },
        { 'SKU': 'VL.INOX.01', 'Tipo': 'VALVULA',  'Categoría': 'ACERO INOX', 'Detalle': '1/2"',     'Unidad': 'PIEZA', 'Cant. Uso': '', 'Unidad Uso': '' },
        { 'SKU': 'TU.COB.02', 'Tipo': 'TUBO',      'Categoría': 'COBRE',      'Detalle': '3/4 PULG', 'Unidad': 'METRO', 'Cant. Uso': '', 'Unidad Uso': '' },
        { 'SKU': 'AC.TAMBO', 'Tipo': 'ACEITE',     'Categoría': 'LUBRICANTE', 'Detalle': 'MOTOR',    'Unidad': 'TAMBO', 'Cant. Uso': 208, 'Unidad Uso': 'LITRO' },
      ];

      const ws = XLSX.utils.json_to_sheet(plantillaData);
      ws['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PlantillaProductos");
      XLSX.writeFile(wb, "plantilla_carga_masiva_productos.xlsx");

      toast.success("📥 Plantilla descargada correctamente");
    } catch (error) {
      console.error("Error al descargar plantilla:", error);
      toast.error("❌ Error al descargar la plantilla");
    }
  };

  // --- HandleChange ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let parsedValue;

    if (type === "checkbox") {
      parsedValue = checked;
    } else if (name === 'unidad_de_compra' || name === 'unidad_uso_id' || name === 'cantidad_uso') {
      parsedValue = value;
    } else {
      parsedValue = value.toUpperCase();
    }

    setFormData({
      ...formData,
      [name]: parsedValue,
    });

    if (name === 'sku') {
      setSkuDisponible(null);
    }
  };

  // --- Manejo de carga de archivo Excel ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      toast.error("❌ Por favor, sube un archivo Excel (.xlsx, .xls) o CSV");
      return;
    }

    setArchivoCargado(file);
    setProcesandoArchivo(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const productosProcesados = procesarDatosExcel(jsonData);
        setProductosCargados(productosProcesados);

        toast.success(`✅ Se cargaron ${productosProcesados.length} productos del archivo`);
      } catch (error) {
        console.error("Error al procesar archivo:", error);
        toast.error("❌ Error al procesar el archivo Excel");
      } finally {
        setProcesandoArchivo(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Procesar datos del Excel ---
  const procesarDatosExcel = (datos) => {
    return datos.map((fila, index) => {
      const sku = fila['SKU'] || fila['sku'] || fila['Código'] || '';
      const tipo = fila['Tipo'] || fila['tipo'] || fila['Categoría'] || '';
      const categoria = fila['Categoría'] || fila['categoria'] || fila['Material'] || '';
      const detalle = fila['Detalle'] || fila['detalle'] || fila['Descripción'] || '';
      const unidad = fila['Unidad'] || fila['unidad'] || fila['Unidad Medida'] || '';
      const cantidadUsoRaw = fila['Cant. Uso'] || fila['Cantidad Uso'] || fila['cantidad_uso'] || '';
      const unidadUsoRaw = fila['Unidad Uso'] || fila['unidad_uso'] || '';

      const unidadEncontrada = unidades.find(u =>
        u.unidad.toLowerCase().includes(unidad.toLowerCase()) ||
        u.simbolo.toLowerCase().includes(unidad.toLowerCase())
      );

      const unidadUsoEncontrada = unidadUsoRaw
        ? unidades.find(u =>
            u.unidad.toLowerCase().includes(String(unidadUsoRaw).toLowerCase()) ||
            u.simbolo.toLowerCase().includes(String(unidadUsoRaw).toLowerCase())
          )
        : null;

      const nombreGenerado = [tipo, categoria, detalle].filter(Boolean).join(" ");
      const existe = productosExistentes.some(p => p.sku.toUpperCase() === String(sku).toUpperCase());
      const cantidadUso = cantidadUsoRaw ? parseFloat(cantidadUsoRaw) : null;

      return {
        id: index + 1,
        sku: String(sku).toUpperCase(),
        tipo: String(tipo).toUpperCase(),
        categoria: String(categoria).toUpperCase(),
        detalle: String(detalle).toUpperCase(),
        nombre: nombreGenerado,
        unidad_de_compra: unidadEncontrada ? unidadEncontrada.id : '',
        unidad_nombre: unidadEncontrada ? `${unidadEncontrada.unidad} (${unidadEncontrada.simbolo})` : unidad,
        cantidad_uso: cantidadUso,
        unidad_uso_id: unidadUsoEncontrada ? unidadUsoEncontrada.id : null,
        activo: true,
        existe: existe,
        valido: sku && tipo && categoria && detalle && unidadEncontrada && !existe
      };
    });
  };

  // --- Cargar productos masivamente ---
  const cargarProductosMasivamente = async () => {
    const productosValidos = productosCargados.filter(p => p.valido);

    if (productosValidos.length === 0) {
      toast.error("❌ No hay productos válidos para cargar");
      return;
    }

    setCargandoMasivamente(true);

    try {
      let exitosos = 0;
      let errores = 0;

      for (const producto of productosValidos) {
        try {
          const payload = {
            sku: producto.sku,
            tipo: producto.tipo,
            categoria: producto.categoria,
            detalle: producto.detalle,
            nombre: producto.nombre,
            unidad_de_compra: producto.unidad_de_compra,
            cantidad_uso: producto.cantidad_uso || null,
            unidad_uso_id: producto.unidad_uso_id || null,
            activo: true,
            ultimo_precio: 0
          };

          await axios.post(`${API_BASE_URL}/api/catalogo_materiales`, payload);
          exitosos++;
        } catch (error) {
          console.error(`Error al cargar producto ${producto.sku}:`, error);
          errores++;
        }
      }

      const respuesta = await axios.get(`${API_BASE_URL}/api/catalogo_materiales`);
      setProductosExistentes(respuesta.data);

      toast.success(`✅ Carga masiva completada: ${exitosos} exitosos, ${errores} errores`);

      if (errores === 0) {
        setModo('individual');
        setArchivoCargado(null);
        setProductosCargados([]);
      }
    } catch (error) {
      console.error("Error en carga masiva:", error);
      toast.error("❌ Error al realizar la carga masiva");
    } finally {
      setCargandoMasivamente(false);
    }
  };

  // --- Envío individual de formulario ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (skuDisponible === false) {
      toast.error("❌ El código SKU ya está en uso. Por favor, usa un código diferente.");
      return;
    }

    if (skuDisponible === null && formData.sku) {
      toast.warning("⏳ Espera a que se valide el SKU antes de guardar.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        nombre: nombreGenerado,
        ultimo_precio: 0,
        unidad_de_compra: parseInt(formData.unidad_de_compra, 10),
        cantidad_uso: formData.cantidad_uso ? parseFloat(formData.cantidad_uso) : null,
        unidad_uso_id: formData.unidad_uso_id ? parseInt(formData.unidad_uso_id, 10) : null,
      };

      const url = `${API_BASE_URL}/api/catalogo_materiales`;
      await axios.post(url, payload);

      toast.success("✅ Producto agregado correctamente");
      setFormData(initialState);
      setSkuDisponible(null);

      const respuesta = await axios.get(`${API_BASE_URL}/api/catalogo_materiales`);
      setProductosExistentes(respuesta.data);

    } catch (error) {
      console.error("Error al agregar producto:", error);
      if (error.code === "ERR_NETWORK") {
        toast.error(`❌ Error de Red: No se pudo conectar a ${API_BASE_URL}.`);
      } else if (error.response) {
        const message = error.response.data?.message || "Error del servidor.";
        toast.error(`❌ Error ${error.response.status}: ${message}`);
      } else {
        toast.error("❌ Hubo un error al guardar. Revisa la consola.");
      }
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setFormData(initialState);
    setSkuDisponible(null);
    toast.info("🧹 Formulario limpiado");
  };

  // --- Gestión de unidades ---
  const iniciarEdicionUnidad = (unidad) => {
    setEditandoUnidadId(unidad.id);
    setEditandoUnidadDatos({ unidad: unidad.unidad, simbolo: unidad.simbolo });
  };

  const cancelarEdicionUnidad = () => {
    setEditandoUnidadId(null);
    setEditandoUnidadDatos({ unidad: '', simbolo: '' });
  };

  const guardarEdicionUnidad = async (id) => {
    if (!editandoUnidadDatos.unidad || !editandoUnidadDatos.simbolo) {
      toast.error("Nombre y símbolo son requeridos");
      return;
    }
    setGuardandoUnidad(true);
    try {
      await axios.put(`${API_BASE_URL}/api/catalogo_unidades/${id}`, editandoUnidadDatos);
      await fetchUnidades();
      cancelarEdicionUnidad();
      toast.success("✅ Unidad actualizada");
    } catch (error) {
      const msg = error.response?.data?.error || "Error al actualizar unidad";
      toast.error(`❌ ${msg}`);
    } finally {
      setGuardandoUnidad(false);
    }
  };

  const crearNuevaUnidad = async () => {
    if (!nuevaUnidad.unidad || !nuevaUnidad.simbolo) {
      toast.error("Nombre y símbolo son requeridos");
      return;
    }
    setGuardandoUnidad(true);
    try {
      await axios.post(`${API_BASE_URL}/api/catalogo_unidades`, nuevaUnidad);
      await fetchUnidades();
      setNuevaUnidad({ unidad: '', simbolo: '' });
      toast.success("✅ Unidad creada");
    } catch (error) {
      const msg = error.response?.data?.error || "Error al crear unidad";
      toast.error(`❌ ${msg}`);
    } finally {
      setGuardandoUnidad(false);
    }
  };

  // --- Estilos dinámicos para el campo SKU ---
  const getSkuInputStyle = () => {
    let style = inputStyle;

    if (validandoSku) {
      style += " border-amber-300 bg-amber-50";
    } else if (skuDisponible === true) {
      style += " border-green-300 bg-green-50";
    } else if (skuDisponible === false) {
      style += " border-red-300 bg-red-50";
    }

    return style;
  };

  const getSkuStatusMessage = () => {
    if (validandoSku) {
      return { text: "Validando SKU...", color: "text-amber-600", icon: <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600"></div> };
    }
    if (skuDisponible === true) {
      return { text: "✅ SKU disponible", color: "text-green-600", icon: <CheckCircleIcon fontSize="small" className="text-green-500" /> };
    }
    if (skuDisponible === false) {
      return { text: "❌ SKU ya está en uso", color: "text-red-600", icon: <ErrorIcon fontSize="small" className="text-red-500" /> };
    }
    return { text: "Ingresa un código SKU único", color: "text-gray-500", icon: null };
  };

  const skuStatus = getSkuStatusMessage();

  // --- Estadísticas de carga masiva ---
  const productosValidos = productosCargados.filter(p => p.valido).length;
  const productosDuplicados = productosCargados.filter(p => p.existe).length;
  const productosInvalidos = productosCargados.filter(p => !p.valido && !p.existe).length;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen"
      autoComplete="off"
    >

      {/* --- SELECTOR DE MODO --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => setModo('individual')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-300 ${
              modo === 'individual'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <AddCircleOutlineIcon />
              <span>Agregar Producto Individual</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModo('masiva')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-300 ${
              modo === 'masiva'
                ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CloudUploadIcon />
              <span>Carga Masiva desde Excel</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModo('unidades')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-300 ${
              modo === 'unidades'
                ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <SettingsIcon />
              <span>Gestionar Unidades</span>
            </div>
          </button>
        </div>
      </div>

      {modo === 'individual' ? (
        /* --- MODO INDIVIDUAL --- */
        <>
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AutoAwesomeIcon className="text-blue-600 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Información del Producto
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label htmlFor="tipo" className={labelStyle}>
                  <CategoryIcon fontSize="small" className="text-blue-500" />
                  Tipo de Producto
                </label>
                <input
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                  placeholder="Ej: CODO, TUBO, VALVULA"
                />
                <p className="text-xs text-gray-500 mt-1">Clasificación principal del producto</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="categoria" className={labelStyle}>
                  <StyleIcon fontSize="small" className="text-indigo-500" />
                  Categoría
                </label>
                <input
                  id="categoria"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                  placeholder="Ej: INOX SOLD. T304, PVC, COBRE"
                />
                <p className="text-xs text-gray-500 mt-1">Especificación o material</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="detalle" className={labelStyle}>
                  <DescriptionIcon fontSize="small" className="text-teal-500" />
                  Detalle Técnico
                </label>
                <input
                  id="detalle"
                  name="detalle"
                  value={formData.detalle}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                  placeholder="Ej: 4 x 90°, 1/2 PULG, 100MM"
                />
                <p className="text-xs text-gray-500 mt-1">Medidas o especificaciones técnicas</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="sku" className={labelStyle}>
                  <InventoryIcon fontSize="small" className="text-amber-500" />
                  Código SKU
                </label>
                <input
                  id="sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  className={getSkuInputStyle()}
                  placeholder="Ej: AC.CS05, VL.INOX.304"
                  maxLength={50}
                />
                <div className="flex items-center gap-2 mt-1">
                  {skuStatus.icon}
                  <p className={`text-xs ${skuStatus.color} font-medium`}>
                    {skuStatus.text}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="unidad_de_compra" className={labelStyle}>
                  <ScaleIcon fontSize="small" className="text-amber-500" />
                  Unidad de Compra
                </label>
                <select
                  id="unidad_de_compra"
                  name="unidad_de_compra"
                  value={formData.unidad_de_compra}
                  onChange={handleChange}
                  required
                  disabled={cargandoUnidades}
                  className={`${inputStyle} ${cargandoUnidades ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">
                    {cargandoUnidades ? "Cargando unidades..." : "Selecciona una unidad..."}
                  </option>
                  {unidades.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>
                      {unidad.unidad} ({unidad.simbolo})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Unidad en que se compra el producto</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="nombre" className={labelStyle}>
                  <AutoAwesomeIcon fontSize="small" className="text-blue-500" />
                  Nombre Generado Automáticamente
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  value={nombreGenerado}
                  readOnly
                  className={inputStyle}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {nombreGenerado ? "✅ Nombre completo generado" : "⚠️ Completa los campos anteriores"}
                </p>
              </div>

              {/* --- CONVERSIÓN DE UNIDADES (OPCIONAL) --- */}
              <div className="lg:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                <p className="text-sm font-semibold text-amber-700">
                  Conversión de Unidades (opcional)
                </p>
                <p className="text-xs text-amber-600">
                  Úsalo cuando el producto se compra en una unidad (ej. TAMBO) pero se consume en otra (ej. LITRO).
                  El inventario se almacenará en la unidad de uso.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="cantidad_uso" className={labelStyle}>
                      Cantidad por unidad de compra
                    </label>
                    <input
                      id="cantidad_uso"
                      name="cantidad_uso"
                      type="number"
                      min="0.001"
                      step="any"
                      value={formData.cantidad_uso}
                      onChange={handleChange}
                      className={inputStyle}
                      placeholder="Ej: 208"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cuántas unidades de uso trae cada unidad de compra</p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="unidad_uso_id" className={labelStyle}>
                      Unidad de Uso
                    </label>
                    <select
                      id="unidad_uso_id"
                      name="unidad_uso_id"
                      value={formData.unidad_uso_id}
                      onChange={handleChange}
                      disabled={cargandoUnidades}
                      className={`${inputStyle} ${cargandoUnidades ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Sin conversión</option>
                      {unidades.map((unidad) => (
                        <option key={unidad.id} value={unidad.id}>
                          {unidad.unidad} ({unidad.simbolo})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Unidad en que se consume/retira del inventario</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <ToggleOnIcon
                    className={`text-2xl ${formData.activo ? 'text-blue-500' : 'text-gray-400'}`}
                  />
                  <span className={labelStyle}>Estado del Producto</span>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="activo" className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="activo"
                      name="activo"
                      type="checkbox"
                      checked={formData.activo}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                  <span className={`text-sm font-medium ${formData.activo ? 'text-green-600' : 'text-gray-600'}`}>
                    {formData.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview y acciones para modo individual */}
          {nombreGenerado && (
            <div className="bg-blue-50 p-6 rounded-xl shadow-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <AutoAwesomeIcon className="text-blue-500" />
                <h3 className="text-lg font-semibold text-blue-700">Vista Previa del Producto</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <span className="font-semibold">Nombre:</span> {nombreGenerado}
                </div>
                <div>
                  <span className="font-semibold">SKU:</span> {formData.sku || "Pendiente"}
                </div>
                <div>
                  <span className="font-semibold">Unidad de Compra:</span> {
                    unidades.find(u => u.id === parseInt(formData.unidad_de_compra))?.unidad || "Pendiente"
                  }
                </div>
                {formData.cantidad_uso && formData.unidad_uso_id && (
                  <div>
                    <span className="font-semibold">Conversión:</span> 1 unidad = {formData.cantidad_uso} {
                      unidades.find(u => u.id === parseInt(formData.unidad_uso_id))?.simbolo || ''
                    }
                  </div>
                )}
                <div>
                  <span className="font-semibold">Estado:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${formData.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {formData.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  {Object.values(formData).some(value => value !== initialState[Object.keys(initialState)[0]])
                    ? "📝 Tienes cambios sin guardar"
                    : "💡 Completa el formulario para agregar un nuevo producto"
                  }
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 min-w-[150px] justify-center"
                >
                  <CleaningServicesIcon fontSize="small"/>
                  Limpiar Todo
                </button>
                <button
                  type="submit"
                  disabled={loading || !nombreGenerado || skuDisponible === false || validandoSku}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 min-w-[150px] justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <AddCircleOutlineIcon />
                      Guardar Producto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : modo === 'masiva' ? (
        /* --- MODO CARGA MASIVA --- */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <TableChartIcon className="text-green-600" />
              <h2 className="text-xl font-bold text-gray-800">Carga Masiva desde Excel</h2>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors duration-300">
              <CloudUploadIcon className="text-gray-400 text-4xl mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                {archivoCargado ? archivoCargado.name : "Sube tu archivo Excel"}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Formatos soportados: .xlsx, .xls, .csv
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors duration-300">
                  <UploadIcon fontSize="small" />
                  Seleccionar Archivo
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={descargarPlantilla}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300"
                >
                  <DownloadIcon fontSize="small" />
                  Descargar Plantilla
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-left">
                <p className="text-sm font-medium text-blue-700 mb-2">📋 Instrucciones:</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Descarga la plantilla y llénala con tus productos</li>
                  <li>• Columnas obligatorias: <strong>SKU, Tipo, Categoría, Detalle, Unidad</strong></li>
                  <li>• Columnas opcionales: <strong>Cant. Uso, Unidad Uso</strong> (para conversión de unidades)</li>
                  <li>• El SKU debe ser único para cada producto</li>
                  <li>• La unidad debe coincidir con las unidades del sistema</li>
                </ul>
              </div>

              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-medium text-amber-700 mb-2">🎯 Formato de ejemplo:</p>
                <div className="text-xs text-amber-600 bg-white p-3 rounded border border-amber-100 overflow-x-auto">
                  <table className="w-full text-left min-w-full">
                    <thead>
                      <tr className="border-b bg-amber-50">
                        <th className="p-2 font-semibold">SKU</th>
                        <th className="p-2 font-semibold">Tipo</th>
                        <th className="p-2 font-semibold">Categoría</th>
                        <th className="p-2 font-semibold">Detalle</th>
                        <th className="p-2 font-semibold">Unidad</th>
                        <th className="p-2 font-semibold">Cant. Uso</th>
                        <th className="p-2 font-semibold">Unidad Uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border-b">AC.CS05</td>
                        <td className="p-2 border-b">CODO</td>
                        <td className="p-2 border-b">INOX SOLD</td>
                        <td className="p-2 border-b">4 x 90°</td>
                        <td className="p-2 border-b">PIEZA</td>
                        <td className="p-2 border-b"></td>
                        <td className="p-2 border-b"></td>
                      </tr>
                      <tr>
                        <td className="p-2">AC.TAMBO</td>
                        <td className="p-2">ACEITE</td>
                        <td className="p-2">LUBRICANTE</td>
                        <td className="p-2">MOTOR</td>
                        <td className="p-2">TAMBO</td>
                        <td className="p-2">208</td>
                        <td className="p-2">LITRO</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {productosCargados.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Previsualización de Productos</h3>
                <div className="flex gap-2 text-sm">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Válidos: {productosValidos}</span>
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Duplicados: {productosDuplicados}</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">Inválidos: {productosInvalidos}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 text-left">Estado</th>
                      <th className="p-3 text-left">SKU</th>
                      <th className="p-3 text-left">Nombre</th>
                      <th className="p-3 text-left">Unidad</th>
                      <th className="p-3 text-left">Conversión</th>
                      <th className="p-3 text-left">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosCargados.slice(0, 10).map((producto) => (
                      <tr key={producto.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          {producto.valido ? (
                            <CheckCircleIcon className="text-green-500" />
                          ) : producto.existe ? (
                            <ErrorIcon className="text-red-500" />
                          ) : (
                            <ErrorIcon className="text-amber-500" />
                          )}
                        </td>
                        <td className="p-3 font-medium">{producto.sku}</td>
                        <td className="p-3">{producto.nombre}</td>
                        <td className="p-3">{producto.unidad_nombre}</td>
                        <td className="p-3 text-xs text-gray-500">
                          {producto.cantidad_uso && producto.unidad_uso_id
                            ? `×${producto.cantidad_uso} ${unidades.find(u => u.id === producto.unidad_uso_id)?.simbolo || ''}`
                            : '—'
                          }
                        </td>
                        <td className="p-3 text-sm">
                          {producto.valido && "✅ Listo para cargar"}
                          {producto.existe && "❌ SKU duplicado"}
                          {!producto.valido && !producto.existe && "⚠️ Datos incompletos"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {productosCargados.length > 10 && (
                  <p className="text-center text-gray-500 mt-4">
                    ... y {productosCargados.length - 10} productos más
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    {productosValidos > 0
                      ? `✅ ${productosValidos} productos listos para cargar`
                      : "⚠️ No hay productos válidos para cargar"
                    }
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setArchivoCargado(null);
                      setProductosCargados([]);
                    }}
                    disabled={cargandoMasivamente}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-300"
                  >
                    <CleaningServicesIcon fontSize="small"/>
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={cargarProductosMasivamente}
                    disabled={cargandoMasivamente || productosValidos === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    {cargandoMasivamente ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Cargando...
                      </>
                    ) : (
                      <>
                        <CloudUploadIcon fontSize="small" />
                        Cargar {productosValidos} Productos
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* --- MODO GESTIONAR UNIDADES --- */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="p-2 bg-amber-100 rounded-lg">
                <SettingsIcon className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Gestionar Unidades de Medida</h2>
                <p className="text-sm text-gray-500">Edita o agrega unidades que se usan en el catálogo de materiales</p>
              </div>
            </div>

            {/* Tabla de unidades existentes */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 text-left font-semibold text-gray-700">Nombre</th>
                    <th className="p-3 text-left font-semibold text-gray-700">Símbolo</th>
                    <th className="p-3 text-center font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      {editandoUnidadId === u.id ? (
                        <>
                          <td className="p-2">
                            <input
                              className="border border-amber-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-300"
                              value={editandoUnidadDatos.unidad}
                              onChange={e => setEditandoUnidadDatos(d => ({ ...d, unidad: e.target.value.toUpperCase() }))}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="border border-amber-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-300"
                              value={editandoUnidadDatos.simbolo}
                              onChange={e => setEditandoUnidadDatos(d => ({ ...d, simbolo: e.target.value.toUpperCase() }))}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => guardarEdicionUnidad(u.id)}
                                disabled={guardandoUnidad}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                <SaveIcon fontSize="inherit" />
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicionUnidad}
                                disabled={guardandoUnidad}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                              >
                                <CancelIcon fontSize="inherit" />
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 font-medium text-gray-800">{u.unidad}</td>
                          <td className="p-3 text-gray-600">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{u.simbolo}</span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => iniciarEdicionUnidad(u)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs rounded-lg hover:bg-amber-100 transition-colors"
                            >
                              <EditIcon fontSize="inherit" />
                              Editar
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Formulario nueva unidad */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-base font-semibold text-gray-700 mb-4">Agregar Nueva Unidad</h3>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Nombre de la unidad</label>
                  <input
                    className="block w-full border border-gray-200 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 sm:text-sm transition-all"
                    value={nuevaUnidad.unidad}
                    onChange={e => setNuevaUnidad(d => ({ ...d, unidad: e.target.value.toUpperCase() }))}
                    placeholder="Ej: KILOGRAMO"
                  />
                </div>
                <div className="sm:w-36 space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Símbolo</label>
                  <input
                    className="block w-full border border-gray-200 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 sm:text-sm transition-all"
                    value={nuevaUnidad.simbolo}
                    onChange={e => setNuevaUnidad(d => ({ ...d, simbolo: e.target.value.toUpperCase() }))}
                    placeholder="Ej: KG"
                  />
                </div>
                <button
                  type="button"
                  onClick={crearNuevaUnidad}
                  disabled={guardandoUnidad || !nuevaUnidad.unidad || !nuevaUnidad.simbolo}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 whitespace-nowrap"
                >
                  {guardandoUnidad ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <AddCircleOutlineIcon fontSize="small" />
                  )}
                  Agregar Unidad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default AgregarProductoForm;
