// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * =================================================================================================
 * G_RFQForm.jsx
 * =================================================================================================
 * FASE 1:
 * - Preferencias UI por usuario (showSku) ✔️
 * - Enriquecimiento de borrador con dataProd ✔️
 * - Aplicar configuración "↓ a todos" desde una línea hacia abajo (sobrescribe) ✅
 */

import React, { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper } from '@mui/material';
import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";
import { useAutoSaveRFQ } from "./rfq/useAutoSaveRFQ";

const DEFAULT_UI_PREFS = { showSku: false };

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
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
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

export default function G_RFQForm({ requisicionId, onBack, mode = 'G' }) {
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [lastUsedProvider, setLastUsedProvider] = useState(null);
  const [archivosNuevosPorProveedor, setArchivosNuevosPorProveedor] = useState({});
  const [archivosExistentesPorProveedor, setArchivosExistentesPorProveedor] = useState({});

  // Preferencias UI (por usuario)
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [uiPrefs, setUiPrefs] = useState(DEFAULT_UI_PREFS);
  const showSku = Boolean(uiPrefs?.showSku);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues
  } = useForm({ defaultValues: { materiales: [] } });

  const { fields: materialFields, replace: replaceMaterialFields } = useFieldArray({
    control,
    name: "materiales"
  });

  const formValues = watch();

  useAutoSaveRFQ({
    requisicionId,
    watch,
    getValues,
    providerConfigs,
    enabled: isDataReady,
  });

  const fetchUiPrefs = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await api.get('/api/ui-preferencias');
      const next = { ...DEFAULT_UI_PREFS, ...(res?.data || {}) };
      setUiPrefs(next);
    } catch (e) {
      console.error('[ui-prefs] error:', e);
      setUiPrefs(DEFAULT_UI_PREFS);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const handleToggleShowSku = useCallback(async (nextValue) => {
    const next = Boolean(nextValue);
    setUiPrefs(prev => ({ ...prev, showSku: next }));
    try {
      await api.put('/api/ui-preferencias', { showSku: next });
      toast.success(next ? 'SKU activado.' : 'SKU oculto.');
    } catch (e) {
      console.error('[ui-prefs] save error:', e);
      setUiPrefs(prev => ({ ...prev, showSku: !next }));
      toast.error('No se pudo guardar la preferencia de SKU.');
    }
  }, []);

  // =============================================================================================
  // ✅ NUEVO: Aplicar configuración "↓ a todos" desde materialIndex en adelante
  // =============================================================================================
  const applyDownFrom = useCallback((materialIndex, opcionIndex) => {
    const materiales = getValues('materiales') || [];
    const srcMat = materiales[materialIndex];
    const srcOpt = srcMat?.opciones?.[opcionIndex];

    if (!srcOpt) {
      toast.error('No se encontró la opción origen para aplicar.');
      return;
    }

    // Lo que vamos a copiar (sobrescribe)
    const patch = {
      proveedor: srcOpt.proveedor ?? null,
      proveedor_id: srcOpt.proveedor?.id ?? srcOpt.proveedor_id ?? null,
      es_entrega_inmediata: Boolean(srcOpt.es_entrega_inmediata),
      tiempo_entrega: srcOpt.tiempo_entrega ?? null,
      tiempo_entrega_valor: srcOpt.tiempo_entrega_valor ?? null,
      tiempo_entrega_unidad: srcOpt.tiempo_entrega_unidad ?? null,
      es_precio_neto: Boolean(srcOpt.es_precio_neto),
      es_importacion: Boolean(srcOpt.es_importacion),
      seleccionado: Boolean(srcOpt.seleccionado),
      unidad_tiempo: srcOpt.unidad_tiempo ?? null,
    };

    // Aplica desde materialIndex hacia abajo SOLO si existe esa opcionIndex en la línea
    for (let i = materialIndex; i < materiales.length; i++) {
      const opt = materiales[i]?.opciones?.[opcionIndex];
      if (!opt) continue;

      const basePath = `materiales.${i}.opciones.${opcionIndex}`;

      setValue(`${basePath}.proveedor`, patch.proveedor, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.proveedor_id`, patch.proveedor_id, { shouldDirty: true, shouldTouch: true });

      setValue(`${basePath}.es_entrega_inmediata`, patch.es_entrega_inmediata, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.tiempo_entrega`, patch.tiempo_entrega, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.unidad_tiempo`, patch.unidad_tiempo, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.tiempo_entrega_valor`, patch.tiempo_entrega_valor, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.tiempo_entrega_unidad`, patch.tiempo_entrega_unidad, { shouldDirty: true, shouldTouch: true });

      setValue(`${basePath}.es_precio_neto`, patch.es_precio_neto, { shouldDirty: true, shouldTouch: true });
      setValue(`${basePath}.es_importacion`, patch.es_importacion, { shouldDirty: true, shouldTouch: true });

      setValue(`${basePath}.seleccionado`, patch.seleccionado, { shouldDirty: true, shouldTouch: true });
    }

    toast.success('Configuración aplicada hacia abajo.');
  }, [getValues, setValue]);

  useEffect(() => {
    const fetchData = async () => {
      if (!requisicionId) return;
      setIsDataReady(false);
      setLoading(true);
      fetchUiPrefs();

      try {
        const dataProd = await api.get(`/api/rfq/${requisicionId}`);
        setRequisicion(dataProd);

        if (dataProd.adjuntos_cotizacion && dataProd.adjuntos_cotizacion.length > 0) {
          const archivosAgrupados = dataProd.adjuntos_cotizacion.reduce((acc, adjunto) => {
            const provId = adjunto.proveedor_id;
            if (!acc[provId]) acc[provId] = [];
            acc[provId].push({ id: adjunto.id, name: adjunto.nombre_archivo, ruta_archivo: adjunto.ruta_archivo });
            return acc;
          }, {});
          setArchivosExistentesPorProveedor(archivosAgrupados);
        }

        let borrador = null;
        try { borrador = await api.get(`/api/rfq/${requisicionId}/borrador`); } catch {}

        if (borrador && borrador.data) {
          toast.info("Se cargó la última instantánea de autoguardado.");
          const { materiales, providerConfigs } = borrador.data;

          // ✅ Enriquecer snapshot con dataProd (incluye sku/material/unidad/cantidad...)
          const prodByDetalleId = new Map((dataProd.materiales || []).map((m) => [m.id, m]));
          const materialesEnriquecidos = (materiales || []).map((mSnap) => {
            const prod = prodByDetalleId.get(mSnap.id);
            if (!prod) return mSnap;
            return {
              ...prod,
              ...mSnap,
              opciones: mSnap.opciones ?? prod.opciones,
              sku: prod.sku ?? mSnap.sku ?? null,
              material: prod.material ?? mSnap.material,
            };
          });

          replaceMaterialFields(materialesEnriquecidos);
          setProviderConfigs(providerConfigs || {});
        } else {
          const initialConfigs = {};
          dataProd.materiales.forEach(m => m.opciones.forEach(op => {
            if (op.seleccionado && op.config_calculo && op.proveedor_id) {
              initialConfigs[op.proveedor_id] = op.config_calculo;
            }
          }));
          setProviderConfigs(initialConfigs);

          const mappedMateriales = dataProd.materiales.map(m => ({
            ...m,
            opciones: m.opciones.length > 0
              ? m.opciones.map(op => ({
                id_bd: op.id,
                ...op,
                precio_unitario: Number(op.precio_unitario) || '',
                cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                proveedor: { id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social }
              }))
              : [{ id_bd: null, proveedor: null, proveedor_id: null, precio_unitario: '', cantidad_cotizada: m.cantidad, seleccionado: false, es_entrega_inmediata: true, es_precio_neto: false, es_importacion: false }]
          }));
          replaceMaterialFields(mappedMateriales);
        }
      } catch (err) {
        toast.error("Error al cargar los detalles de la requisición.");
      } finally {
        setLoading(false);
        setIsDataReady(true);
      }
    };

    fetchData();
  }, [requisicionId, replaceMaterialFields, fetchUiPrefs]);

  // Archivos (sin cambios)
  const handleFileChange = (e, proveedorId) => {
    const nuevosArchivos = Array.from(e.target.files);
    const archivosNuevosActuales = archivosNuevosPorProveedor[proveedorId] || [];
    const archivosExistentesActuales = archivosExistentesPorProveedor[proveedorId] || [];

    if (archivosNuevosActuales.length + archivosExistentesActuales.length + nuevosArchivos.length > 3) {
      toast.warn("Puedes subir un máximo de 3 archivos por proveedor.");
      return;
    }
    for (const file of nuevosArchivos) {
      if (file.size > 50 * 1024 * 1024) {
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

  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const formData = new FormData();
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
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

    const opcionesPayload = data.materiales.flatMap(m =>
      m.opciones
        .filter(o => o.proveedor && o.proveedor.id)
        .map(o => {
          const moneda = (o.proveedor?.id && safeProviderConfigs[o.proveedor.id]?.moneda) || 'MXN';
          return { ...o, id: o.id_bd, proveedor_id: o.proveedor?.id, requisicion_id: requisicionId, requisicion_detalle_id: m.id, moneda };
        })
    );
    formData.append('opciones', JSON.stringify(opcionesPayload));

    const resumenesPayload = calcularResumenes(data.materiales, safeProviderConfigs);
    formData.append('resumenes', JSON.stringify(resumenesPayload));
    formData.append('rfq_code', requisicion.rfq_code);

    for (const proveedorId in archivosNuevosPorProveedor) {
      const archivos = archivosNuevosPorProveedor[proveedorId];
      if (archivos && archivos.length > 0) {
        archivos.forEach(file => formData.append(`cotizacion-archivo-${proveedorId}`, file));
      }
    }
    formData.append('archivos_existentes_por_proveedor', JSON.stringify(archivosExistentesPorProveedor));

    try {
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData);
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
            proveedor: { id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social }
          }))
          : [{ id_bd: null, proveedor: null, proveedor_id: null, precio_unitario: '', cantidad_cotizada: m.cantidad, seleccionado: false, es_entrega_inmediata: true, es_precio_neto: false, es_importacion: false }]
      }));
      replaceMaterialFields(mappedMateriales);

    } catch (err) {
      toast.error(err.error || "Error al guardar la comparativa.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnviarAprobacion = async () => {
    try {
      await handleSubmit(onSaveSubmit)();
    } catch (saveError) {
      console.error("Falló el guardado, no se enviará a aprobación.", saveError);
      return;
    }

    if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
    try {
      await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
      toast.info("RFQ enviada a aprobación.");
      onBack();
    } catch (err) {
      toast.error(err.error || "Error al enviar a aprobación.");
    }
  };

  const handleSaveAndExit = async () => {
    try {
      await handleSubmit(onSaveSubmit)();
      toast.success(mode === 'VB' ? "Actualizado con éxito." : "¡Guardado en Producción con éxito!");
      onBack();
    } catch (error) {
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
        showSku={showSku}
        onToggleShowSku={handleToggleShowSku}
        prefsLoading={prefsLoading}
      />

      <form>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  showSku={showSku}
                  // ✅ NUEVO: callback para aplicar ↓ desde esta fila
                  onApplyDownFrom={applyDownFrom}
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
          mode={mode}
        />
      </form>
    </Paper>
  );
}
