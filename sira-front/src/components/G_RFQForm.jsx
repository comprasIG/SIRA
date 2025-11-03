// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: G_RFQForm (v2.4 - Corrección Filtro NOT NULL y Toast)
 * =================================================================================================
 * @file G_RFQForm.jsx
 * @description Componente principal para la pantalla de cotización (RFQ). Orquesta la carga
 * de datos, la gestión del formulario y el envío de cotizaciones.
 */

// --- Importaciones de Librerías y Componentes ---
import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper } from '@mui/material';
import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";

// Lógica de Cálculo (sin cambios)
const calcularResumenes = (materiales, providerConfigs) => {
  if (!materiales || materiales.length === 0) return [];
  const agrupado = {};
  materiales.forEach(material => {
    material.opciones?.forEach(opcion => {
      if (opcion && opcion.seleccionado && opcion.proveedor?.id && Number(opcion.cantidad_cotizada) > 0) {
        const proveedorId = opcion.proveedor.id;
        if (!agrupado[proveedorId]) {
          agrupado[proveedorId] = {
            proveedorId,
            proveedorNombre: opcion.proveedor.razon_social || opcion.proveedor.nombre,
            items: [],
          };
        }
        agrupado[proveedorId].items.push({
          cantidad: Number(opcion.cantidad_cotizada) || 0,
          precioUnitario: Number(opcion.precio_unitario) || 0,
          esPrecioNeto: opcion.es_precio_neto,
          esImportacionItem: opcion.es_importacion,
        });
      }
    });
  });
  return Object.values(agrupado).map(grupo => {
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIvaActive: false, forcedTotal: '0', isForcedTotalActive: false };
    const config = providerConfigs[grupo.proveedorId] || defaultConfig;
    const ivaRateNum = parseFloat(config.ivaRate) || 0;
    const isrRateNum = parseFloat(config.isrRate) || 0;
    const forcedTotalNum = parseFloat(config.forcedTotal) || 0;
    const esCompraImportacion = grupo.items.some(item => item.esImportacionItem);
    let subTotal = 0;
    grupo.items.forEach(item => {
      let precioBase = item.precioUnitario;
      if (item.esPrecioNeto && config.isIvaActive && ivaRateNum > 0) {
        precioBase = item.precioUnitario / (1 + ivaRateNum);
      }
      subTotal += item.cantidad * precioBase;
    });
    const iva = (esCompraImportacion || !config.isIvaActive) ? 0 : subTotal * ivaRateNum;
    const retIsr = (esCompraImportacion || !config.isIsrActive) ? 0 : subTotal * isrRateNum;
    let total = config.isForcedTotalActive ? forcedTotalNum : subTotal + iva - retIsr;
    return { proveedorId: grupo.proveedorId, subTotal, iva, retIsr, total, config };
  });
};

// ===============================================================================================
// --- Componente Principal: G_RFQForm ---
// ===============================================================================================
export default function G_RFQForm({ requisicionId, onBack }) {

  // --- Estados del Componente ---
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [lastUsedProvider, setLastUsedProvider] = useState(null);
  const [archivosNuevosPorProveedor, setArchivosNuevosPorProveedor] = useState({});
  const [archivosExistentesPorProveedor, setArchivosExistentesPorProveedor] = useState({});

  // --- Configuración de `react-hook-form` ---
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues
  } = useForm({ defaultValues: { materiales: [] } });

  const { fields: materialFields, replace: replaceMaterialFields } = useFieldArray({
    control,
    name: "materiales"
  });
  const formValues = watch();

  // --- Carga de Datos Inicial (Efecto) ---
  useEffect(() => {
    const fetchData = async () => {
      if (!requisicionId) return;
      setIsDataReady(false);
      setLoading(true);
      try {
        const data = await api.get(`/api/rfq/${requisicionId}`);
        setRequisicion(data);

        const initialConfigs = {};
        data.materiales.forEach(m => m.opciones.forEach(op => {
          if (op.seleccionado && op.config_calculo && op.proveedor_id) {
            initialConfigs[op.proveedor_id] = op.config_calculo;
          }
        }));
        setProviderConfigs(initialConfigs);

        if (data.adjuntos_cotizacion && data.adjuntos_cotizacion.length > 0) {
          const archivosAgrupados = data.adjuntos_cotizacion.reduce((acc, adjunto) => {
            const provId = adjunto.proveedor_id;
            if (!acc[provId]) {
              acc[provId] = [];
            }
            acc[provId].push({
              id: adjunto.id,
              name: adjunto.nombre_archivo,
              ruta_archivo: adjunto.ruta_archivo
            });
            return acc;
          }, {});
          setArchivosExistentesPorProveedor(archivosAgrupados);
        }

        const mappedMateriales = data.materiales.map(m => ({
          ...m, // Importante: m.id (de req_detalle) se mantiene
          opciones: m.opciones.length > 0
            ? m.opciones.map(op => ({
                id_bd: op.id, // ID REAL de la base de datos
                ...op,
                precio_unitario: Number(op.precio_unitario) || '',
                cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                proveedor: {
                  id: op.proveedor_id,
                  nombre: op.proveedor_nombre,
                  razon_social: op.proveedor_razon_social
                }
              }))
            : [{
                id_bd: null,
                proveedor: null,
                proveedor_id: null,
                precio_unitario: '',
                cantidad_cotizada: m.cantidad,
                seleccionado: false,
                es_entrega_inmediata: true,
                es_precio_neto: false,
                es_importacion: false
              }]
        }));

        replaceMaterialFields(mappedMateriales);
        setIsDataReady(true);
      } catch (err) {
        toast.error("Error al cargar los detalles de la requisición.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requisicionId, replaceMaterialFields]); // Añadir replaceMaterialFields

  // --- Handlers de Archivos (sin cambios) ---
  const handleFileChange = (e, proveedorId) => {
    const nuevosArchivos = Array.from(e.target.files);
    const archivosNuevosActuales = archivosNuevosPorProveedor[proveedorId] || [];
    const archivosExistentesActuales = archivosExistentesPorProveedor[proveedorId] || [];

    if (archivosNuevosActuales.length + archivosExistentesActuales.length + nuevosArchivos.length > 3) {
      toast.warn("Puedes subir un máximo de 3 archivos por proveedor.");
      return;
    }
    for (const file of nuevosArchivos) {
      if (file.size > 50 * 1024 * 1024) { // 50MB
        toast.warn(`El archivo "${file.name}" es demasiado grande (Máx. 50MB).`);
        return;
      }
    }
    setArchivosNuevosPorProveedor(prev => ({
      ...prev,
      [proveedorId]: [...(prev[proveedorId] || []), ...nuevosArchivos]
    }));
  };

  const handleRemoveNewFile = (proveedorId, fileName) => {
    setArchivosNuevosPorProveedor(prev => ({
      ...prev,
      [proveedorId]: (prev[proveedorId] || []).filter(f => f.name !== fileName)
    }));
  };

  const handleRemoveExistingFile = (proveedorId, fileId) => {
    setArchivosExistentesPorProveedor(prev => ({
      ...prev,
      [proveedorId]: (prev[proveedorId] || []).filter(f => f.id !== fileId)
    }));
  };
  // ---

  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const formData = new FormData();

    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIvaActive: false, forcedTotal: '0', isForcedTotalActive: false };
    const safeProviderConfigs = { ...providerConfigs };
    const selectedProviderIds = new Set(
      data.materiales.flatMap(m => m.opciones)
        .filter(o => o.seleccionado && o.proveedor?.id)
        .map(o => o.proveedor.id)
    );
    selectedProviderIds.forEach(id => {
      if (!safeProviderConfigs[id]) safeProviderConfigs[id] = defaultConfig;
      else if (!safeProviderConfigs[id].moneda) safeProviderConfigs[id].moneda = 'MXN';
    });
    
    // ==================================================================
    // --- CORRECCIÓN BUG GUARDADO: Restaurar filtro .filter(...) ---
    // La BD no permite `proveedor_id` nulo, por lo que DEBEMOS filtrar
    // las opciones que no tengan un proveedor.
    // ==================================================================
    const opcionesPayload = data.materiales.flatMap(m =>
      m.opciones
        .filter(o => o.proveedor && o.proveedor.id) // <-- FILTRO RESTAURADO
        .map(o => {
          const moneda = (o.proveedor?.id && safeProviderConfigs[o.proveedor.id]?.moneda) || 'MXN';
          // m.id es el requisicion_detalle_id
          return { ...o, id: o.id_bd, proveedor_id: o.proveedor?.id, requisicion_id: requisicionId, requisicion_detalle_id: m.id, moneda };
        })
    );
    formData.append('opciones', JSON.stringify(opcionesPayload));
    
    // Resúmenes (sin cambios)
    const resumenesPayload = calcularResumenes(data.materiales, safeProviderConfigs);
    formData.append('resumenes', JSON.stringify(resumenesPayload));
    formData.append('rfq_code', requisicion.rfq_code);

    // Envío de archivos (sin cambios)
    for (const proveedorId in archivosNuevosPorProveedor) {
      const archivos = archivosNuevosPorProveedor[proveedorId];
      if (archivos && archivos.length > 0) {
        archivos.forEach(file => {
          formData.append(`cotizacion-archivo-${proveedorId}`, file);
        });
      }
    }
    formData.append('archivos_existentes_por_proveedor', JSON.stringify(archivosExistentesPorProveedor));

    try {
      // NOTA: El toast de éxito se mueve a 'handleSaveAndExit'
      // para que solo se muestre en esa acción.
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData);
      
      // Sincronizar estado tras guardado (sin cambios)
      const newData = await api.get(`/api/rfq/${requisicionId}`);
      if (newData.adjuntos_cotizacion && newData.adjuntos_cotizacion.length > 0) {
          const archivosAgrupados = newData.adjuntos_cotizacion.reduce((acc, adjunto) => {
            const provId = adjunto.proveedor_id;
            if (!acc[provId]) acc[provId] = [];
            acc[provId].push({ id: adjunto.id, name: adjunto.nombre_archivo, ruta_archivo: adjunto.ruta_archivo });
            return acc;
          }, {});
          setArchivosExistentesPorProveedor(archivosAgrupados);
          setArchivosNuevosPorProveedor({}); 
      }
      
      const mappedMateriales = newData.materiales.map(m => ({
          ...m,
          opciones: m.opciones.length > 0
            ? m.opciones.map(op => ({
                id_bd: op.id,
                ...op,
                precio_unitario: Number(op.precio_unitario) || '',
                cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                proveedor: {
                  id: op.proveedor_id,
                  nombre: op.proveedor_nombre,
                  razon_social: op.proveedor_razon_social
                }
              }))
            : [{ id_bd: null, proveedor: null, proveedor_id: null, precio_unitario: '', cantidad_cotizada: m.cantidad, seleccionado: false, es_entrega_inmediata: true, es_precio_neto: false, es_importacion: false }]
        }));
      replaceMaterialFields(mappedMateriales);

    } catch (err) {
      // El toast de error ya se maneja en el .catch() de los handlers
      toast.error(err.error || "Error al guardar la comparativa.");
      throw err; 
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handlers de Acciones ---

  const handleEnviarAprobacion = async () => {
    try {
      // 1. Guardar
      await handleSubmit(onSaveSubmit)();
    } catch (saveError) {
      // 2. Si guardar falla, no continuar
      console.error("Falló el guardado, no se enviará a aprobación.", saveError);
      return;
    }

    // 3. Confirmar y Enviar
    if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
    try {
      await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
      toast.info("RFQ enviada a aprobación."); // Notificación específica
      onBack();
    } catch (err) {
      toast.error(err.error || "Error al enviar a aprobación.");
    }
  };

  const handleSaveAndExit = async () => {
    try {
      // 1. Guardar
      await handleSubmit(onSaveSubmit)();
      
      // ==================================================================
      // --- CAMBIO: Añadir Toast de Éxito ---
      // ==================================================================
      toast.success("¡Guardado con éxito!");
      
      // 2. Salir (solo si el guardado fue exitoso)
      onBack();

    } catch (error) {
      // 3. Si el guardado falla, onSaveSubmit ya mostró un toast de error
      // y nosotros simplemente no salimos de la página.
      console.error("El guardado falló, el usuario permanecerá en la página.");
    }
  };
  
  return (
    <Paper elevation={2} className="p-4 md:p-6">
      <RFQFormHeader
        onBack={onBack}
        rfq_code={requisicion?.rfq_code}
        proyecto={requisicion?.proyecto}
        sitio={requisicion?.sitio}
      />
      <form>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CORRECCIÓN BUG VISUAL: (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-4">
            <fieldset disabled={loading || isSaving}>
              {materialFields.map((item, index) => (
                <MaterialCotizacionRow
                  key={item.id}
                  control={control}
                  materialIndex={index}
                  setValue={setValue}
                  lastUsedProvider={lastUsedProvider}
                  setLastUsedProvider={setLastUsedProvider}
                  opcionesBloqueadas={requisicion?.opciones_bloqueadas || []}
                />
              ))}
            </fieldset>
            {loading && <div className="text-center p-4"><CircularProgress /></div>}
          </div>

          <div className="lg:col-span-1">
            <ResumenCompra
              materiales={formValues.materiales} 
              lugar_entrega={requisicion?.lugar_entrega_nombre || requisicion?.lugar_entrega}
              providerConfigs={providerConfigs}
              setProviderConfigs={setProviderConfigs}
              archivosNuevosPorProveedor={archivosNuevosPorProveedor}
              archivosExistentesPorProveedor={archivosExistentesPorProveedor}
              onFileChange={handleFileChange}
              onRemoveNewFile={handleRemoveNewFile}
              onRemoveExistingFile={handleRemoveExistingFile}
              opcionesBloqueadas={requisicion?.opciones_bloqueadas || []}
            />
          </div>
        </div>

        <RFQFormActions
          isSaving={isSaving}
          isLoading={loading}
          onSaveAndExit={handleSaveAndExit}
          onSendToApproval={handleEnviarAprobacion}
        />
      </form>
    </Paper>
  );
}