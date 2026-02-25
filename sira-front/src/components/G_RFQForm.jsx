// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * =================================================================================================
 * G_RFQForm.jsx
 * =================================================================================================
 * FASE 1:
 * - Preferencias UI por usuario (showSku) ✔️
 * - Enriquecimiento de borrador con dataProd ✔️
 * - Aplicar configuración "↓ a todos" desde una línea hacia abajo (sobrescribe) ✅
 * - Reordenamiento de materiales (drag & drop) + persistencia en BD (rfq_sort_index) ✅
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper } from "@mui/material";

import MaterialCotizacionRow from "./rfq/MaterialCotizacionRow";
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";
import AgregarMaterialRFQ from "./rfq/AgregarMaterialRFQ";
import { useAutoSaveRFQ } from "./rfq/useAutoSaveRFQ";

// ✅ Drag & Drop (dnd-kit)
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_UI_PREFS = { showSku: false };

const calcularResumenes = (materiales, providerConfigs) => {
  if (!materiales || materiales.length === 0) return [];
  const agrupado = {};
  materiales.forEach((material) => {
    material.opciones?.forEach((opcion) => {
      if (
        opcion &&
        opcion.seleccionado &&
        opcion.proveedor?.id &&
        Number(opcion.cantidad_cotizada) > 0
      ) {
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

  return Object.values(agrupado).map((grupo) => {
    const defaultConfig = {
      moneda: "MXN",
      ivaRate: "0.16",
      isIvaActive: true,
      isrRate: "0.0125",
      isIsrActive: false,
      forcedTotal: "0",
      isForcedTotalActive: false,
    };
    const config = providerConfigs[grupo.proveedorId] || defaultConfig;

    const ivaRateNum = parseFloat(config.ivaRate) || 0;
    const isrRateNum = parseFloat(config.isrRate) || 0;
    const forcedTotalNum = parseFloat(config.forcedTotal) || 0;

    const esCompraImportacion = grupo.items.some((item) => item.esImportacionItem);

    let subTotal = 0;
    grupo.items.forEach((item) => {
      let precioBase = item.precioUnitario;
      // Si el item está capturado como NETO, convertimos a base sin IVA para cálculo interno
      if (item.esPrecioNeto && config.isIvaActive && ivaRateNum > 0) {
        precioBase = item.precioUnitario / (1 + ivaRateNum);
      }
      subTotal += item.cantidad * precioBase;
    });

    const iva = esCompraImportacion || !config.isIvaActive ? 0 : subTotal * ivaRateNum;
    const retIsr = esCompraImportacion || !config.isIsrActive ? 0 : subTotal * isrRateNum;

    // Descuento global
    let descuento = 0;
    if (config.isDiscountActive) {
      const discountVal = parseFloat(config.discountValue) || 0;
      if (config.discountType === 'porcentaje') {
        descuento = subTotal * (discountVal / 100);
      } else {
        descuento = discountVal;
      }
    }

    let total = config.isForcedTotalActive ? forcedTotalNum : subTotal + iva - retIsr - descuento;

    return { proveedorId: grupo.proveedorId, subTotal, iva, retIsr, descuento, total, config };
  });
};

/**
 * ===============================================================================================
 * SortableMaterialWrapper
 * - Encapsula useSortable
 * - Pasa dragHandleProps a MaterialCotizacionRow para que SOLO el icono arrastre
 * ===============================================================================================
 */
function SortableMaterialWrapper({ dndId, children, disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndId,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { attributes, listeners },
      })}
    </div>
  );
}

export default function G_RFQForm({ requisicionId, onBack, mode = "G" }) {
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [lastUsedProvider, setLastUsedProvider] = useState(null);
  const [archivosNuevosPorProveedor, setArchivosNuevosPorProveedor] = useState({});
  const [archivosExistentesPorProveedor, setArchivosExistentesPorProveedor] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  // Preferencias UI (por usuario)
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [uiPrefs, setUiPrefs] = useState(DEFAULT_UI_PREFS);
  const showSku = Boolean(uiPrefs?.showSku);

  const { control, handleSubmit, watch, setValue, getValues } = useForm({
    defaultValues: { materiales: [] },
  });

  /**
   * ✅ IMPORTANTE (profesional):
   * Para evitar colisión entre:
   * - `id` (id real de BD: requisiciones_detalle.id)
   * - `id` interno de RHF (uuid)
   * usamos `keyName: 'key'` para que RHF ponga su uuid en `key`
   * y mantengamos `id` para BD.
   */
  const {
    fields: materialFields,
    replace: replaceMaterialFields,
    move: moveMaterial,
  } = useFieldArray({
    control,
    name: "materiales",
    keyName: "key",
  });

  const formValues = watch();

  useAutoSaveRFQ({
    requisicionId,
    watch,
    getValues,
    providerConfigs,
    enabled: isDataReady,
  });

  // ==========================================
  // UI Prefs: load/save
  // ==========================================
  const fetchUiPrefs = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await api.get("/api/ui-preferencias");
      const next = { ...DEFAULT_UI_PREFS, ...(res?.data || {}) };
      setUiPrefs(next);
    } catch (e) {
      console.error("[ui-prefs] error:", e);
      setUiPrefs(DEFAULT_UI_PREFS);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const handleToggleShowSku = useCallback(async (nextValue) => {
    const next = Boolean(nextValue);
    setUiPrefs((prev) => ({ ...prev, showSku: next }));
    try {
      await api.put("/api/ui-preferencias", { showSku: next });
      toast.success(next ? "SKU activado." : "SKU oculto.");
    } catch (e) {
      console.error("[ui-prefs] save error:", e);
      setUiPrefs((prev) => ({ ...prev, showSku: !next }));
      toast.error("No se pudo guardar la preferencia de SKU.");
    }
  }, []);

  // =============================================================================================
  // ✅ Aplicar configuración "↓ a todos" desde materialIndex en adelante
  // =============================================================================================
  const applyDownFrom = useCallback(
    (materialIndex, opcionIndex) => {
      const materiales = getValues("materiales") || [];
      const srcMat = materiales[materialIndex];
      const srcOpt = srcMat?.opciones?.[opcionIndex];

      if (!srcOpt) {
        toast.error("No se encontró la opción origen para aplicar.");
        return;
      }

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
      };

      for (let i = materialIndex; i < materiales.length; i++) {
        const opt = materiales[i]?.opciones?.[opcionIndex];
        if (!opt) continue;

        const basePath = `materiales.${i}.opciones.${opcionIndex}`;

        setValue(`${basePath}.proveedor`, patch.proveedor, { shouldDirty: true, shouldTouch: true });
        setValue(`${basePath}.proveedor_id`, patch.proveedor_id, {
          shouldDirty: true,
          shouldTouch: true,
        });

        setValue(`${basePath}.es_entrega_inmediata`, patch.es_entrega_inmediata, {
          shouldDirty: true,
          shouldTouch: true,
        });
        setValue(`${basePath}.tiempo_entrega`, patch.tiempo_entrega, {
          shouldDirty: true,
          shouldTouch: true,
        });
        setValue(`${basePath}.tiempo_entrega_valor`, patch.tiempo_entrega_valor, {
          shouldDirty: true,
          shouldTouch: true,
        });
        setValue(`${basePath}.tiempo_entrega_unidad`, patch.tiempo_entrega_unidad, {
          shouldDirty: true,
          shouldTouch: true,
        });

        setValue(`${basePath}.es_precio_neto`, patch.es_precio_neto, {
          shouldDirty: true,
          shouldTouch: true,
        });
        setValue(`${basePath}.es_importacion`, patch.es_importacion, {
          shouldDirty: true,
          shouldTouch: true,
        });

        setValue(`${basePath}.seleccionado`, patch.seleccionado, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      toast.success("Configuración aplicada hacia abajo.");
    },
    [getValues, setValue]
  );

  // =============================================================================================
  // Carga inicial (dataProd + borrador)
  // =============================================================================================
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
            acc[provId].push({
              id: adjunto.id,
              name: adjunto.nombre_archivo,
              ruta_archivo: adjunto.ruta_archivo,
            });
            return acc;
          }, {});
          setArchivosExistentesPorProveedor(archivosAgrupados);
        }

        let borrador = null;
        try {
          borrador = await api.get(`/api/rfq/${requisicionId}/borrador`);
        } catch { }

        if (borrador && borrador.data) {
          toast.info("Se cargó la última instantánea de autoguardado.");
          const { materiales, providerConfigs } = borrador.data;

          // ✅ Enriquecer snapshot con dataProd (incluye sku/material/unidad/cantidad...)
          const prodByDetalleId = new Map((dataProd.materiales || []).map((m) => [m.id, m]));
          const snapshotIds = new Set((materiales || []).map((m) => m.id));
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

          // ✅ Agregar materiales nuevos que no estaban en el snapshot (ej. materiales adicionales)
          (dataProd.materiales || []).forEach((prod) => {
            if (!snapshotIds.has(prod.id)) {
              materialesEnriquecidos.push({
                ...prod,
                opciones: prod.opciones.length > 0
                  ? prod.opciones.map((op) => ({
                    id_bd: op.id,
                    ...op,
                    precio_unitario: Number(op.precio_unitario) || "",
                    cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                    proveedor: {
                      id: op.proveedor_id,
                      nombre: op.proveedor_nombre,
                      razon_social: op.proveedor_razon_social,
                    },
                  }))
                  : [{
                    id_bd: null,
                    proveedor: null,
                    proveedor_id: null,
                    precio_unitario: "",
                    cantidad_cotizada: prod.cantidad,
                    seleccionado: false,
                    es_entrega_inmediata: true,
                    es_precio_neto: false,
                    es_importacion: false,
                  }],
              });
            }
          });

          replaceMaterialFields(materialesEnriquecidos);
          setProviderConfigs(providerConfigs || {});
        } else {
          const initialConfigs = {};
          dataProd.materiales.forEach((m) =>
            m.opciones.forEach((op) => {
              if (op.seleccionado && op.config_calculo && op.proveedor_id) {
                initialConfigs[op.proveedor_id] = op.config_calculo;
              }
            })
          );
          setProviderConfigs(initialConfigs);

          const mappedMateriales = dataProd.materiales.map((m) => ({
            ...m,
            opciones:
              m.opciones.length > 0
                ? m.opciones.map((op) => ({
                  id_bd: op.id,
                  ...op,
                  precio_unitario: Number(op.precio_unitario) || "",
                  cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                  proveedor: {
                    id: op.proveedor_id,
                    nombre: op.proveedor_nombre,
                    razon_social: op.proveedor_razon_social,
                  },
                }))
                : [
                  {
                    id_bd: null,
                    proveedor: null,
                    proveedor_id: null,
                    precio_unitario: "",
                    cantidad_cotizada: m.cantidad,
                    seleccionado: false,
                    es_entrega_inmediata: true,
                    es_precio_neto: false,
                    es_importacion: false,
                  },
                ],
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
  }, [fetchUiPrefs, replaceMaterialFields, requisicionId, reloadKey]);

  // Handler para refrescar tras agregar material adicional
  const handleMaterialAdded = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // =============================================================================================
  // Archivos (cotizaciones)
  // =============================================================================================
  const handleFileChange = (proveedorId, event) => {
    const nuevosArchivos = Array.from(event.target.files);
    if (!nuevosArchivos || nuevosArchivos.length === 0) return;

    for (const file of nuevosArchivos) {
      if (file.size > 50 * 1024 * 1024) {
        toast.warn(`El archivo "${file.name}" es demasiado grande (Máx. 50MB).`);
        return;
      }
    }

    setArchivosNuevosPorProveedor((prev) => ({
      ...prev,
      [proveedorId]: [...(prev[proveedorId] || []), ...nuevosArchivos],
    }));
  };

  const handleRemoveNewFile = (proveedorId, fileName) => {
    setArchivosNuevosPorProveedor((prev) => ({
      ...prev,
      [proveedorId]: (prev[proveedorId] || []).filter((f) => f.name !== fileName),
    }));
  };

  const handleRemoveExistingFile = (proveedorId, fileId) => {
    setArchivosExistentesPorProveedor((prev) => ({
      ...prev,
      [proveedorId]: (prev[proveedorId] || []).filter((f) => f.id !== fileId),
    }));
  };

  // =============================================================================================
  // Guardado "Producción"
  // =============================================================================================
  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const formData = new FormData();

    const defaultConfig = {
      moneda: "MXN",
      ivaRate: "0.16",
      isIvaActive: true,
      isrRate: "0.0125",
      isIsrActive: false,
      forcedTotal: "0",
      isForcedTotalActive: false,
    };
    const safeProviderConfigs = { ...providerConfigs };

    const selectedProviderIds = new Set(
      data.materiales
        .flatMap((m) => m.opciones)
        .filter((o) => o.seleccionado && o.proveedor?.id)
        .map((o) => o.proveedor.id)
    );

    selectedProviderIds.forEach((id) => {
      if (!safeProviderConfigs[id]) safeProviderConfigs[id] = defaultConfig;
      else if (!safeProviderConfigs[id].moneda) safeProviderConfigs[id].moneda = "MXN";
    });

    const opcionesPayload = data.materiales.flatMap((m) =>
      m.opciones
        .filter((o) => o.proveedor && o.proveedor.id)
        .map((o) => {
          const moneda = (o.proveedor?.id && safeProviderConfigs[o.proveedor.id]?.moneda) || "MXN";
          return {
            ...o,
            id: o.id_bd,
            proveedor_id: o.proveedor?.id,
            requisicion_id: requisicionId,
            requisicion_detalle_id: m.id,
            moneda,
          };
        })
    );

    formData.append("opciones", JSON.stringify(opcionesPayload));

    const resumenesPayload = calcularResumenes(data.materiales, safeProviderConfigs);
    formData.append("resumenes", JSON.stringify(resumenesPayload));
    formData.append("rfq_code", requisicion.rfq_code);

    for (const proveedorId in archivosNuevosPorProveedor) {
      const archivos = archivosNuevosPorProveedor[proveedorId];
      if (archivos && archivos.length > 0) {
        archivos.forEach((file) => {
          formData.append(`cotizacion-archivo-${proveedorId}`, file);
        });
      }
    }
    formData.append("archivos_existentes_por_proveedor", JSON.stringify(archivosExistentesPorProveedor));

    try {
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData);

      // Refrescar estado
      const newData = await api.get(`/api/rfq/${requisicionId}`);

      if (newData.adjuntos_cotizacion && newData.adjuntos_cotizacion.length > 0) {
        const archivosAgrupados = newData.adjuntos_cotizacion.reduce((acc, adjunto) => {
          const provId = adjunto.proveedor_id;
          if (!acc[provId]) acc[provId] = [];
          acc[provId].push({
            id: adjunto.id,
            name: adjunto.nombre_archivo,
            ruta_archivo: adjunto.ruta_archivo,
          });
          return acc;
        }, {});
        setArchivosExistentesPorProveedor(archivosAgrupados);
        setArchivosNuevosPorProveedor({});
      }

      const mappedMateriales = newData.materiales.map((m) => ({
        ...m,
        opciones:
          m.opciones.length > 0
            ? m.opciones.map((op) => ({
              id_bd: op.id,
              ...op,
              precio_unitario: Number(op.precio_unitario) || "",
              cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
              proveedor: {
                id: op.proveedor_id,
                nombre: op.proveedor_nombre,
                razon_social: op.proveedor_razon_social,
              },
            }))
            : [
              {
                id_bd: null,
                proveedor: null,
                proveedor_id: null,
                precio_unitario: "",
                cantidad_cotizada: m.cantidad,
                seleccionado: false,
                es_entrega_inmediata: true,
                es_precio_neto: false,
                es_importacion: false,
              },
            ],
      }));

      replaceMaterialFields(mappedMateriales);
    } catch (err) {
      toast.error(err.error || "Error al guardar la comparativa.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // =============================================================================================
  // Acciones
  // =============================================================================================
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
      toast.success(mode === "VB" ? "Actualizado con éxito." : "¡Guardado en Producción con éxito!");
      onBack();
    } catch (error) {
      console.error("El guardado falló, el usuario permanecerá en la página.");
    }
  };

  // =============================================================================================
  // ✅ Drag & Drop: IDs + Persistencia
  // =============================================================================================
  const materialesValues = formValues.materiales || [];

  // IDs estables para DnD: mat-<requisiciones_detalle.id>
  const dndIds = useMemo(() => {
    return materialesValues.map((m, idx) => `mat-${m?.id ?? `idx-${idx}`}`);
  }, [materialesValues]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // evita que un click normal dentro de inputs dispare drag
      activationConstraint: { distance: 8 },
    })
  );

  const persistSortOrder = useCallback(
    async (orderedDetalleIds) => {
      // Endpoint ya agregado en tu backend:
      // PUT /api/rfq/:requisicionId/materiales/orden { orderedDetalleIds: number[] }
      await api.put(`/api/rfq/${requisicionId}/materiales/orden`, { orderedDetalleIds });
    },
    [requisicionId]
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = dndIds.indexOf(active.id);
      const newIndex = dndIds.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      // Guardamos orden previo (por si hay que revertir)
      const before = (getValues("materiales") || []).map((m) => m?.id).filter(Boolean);

      // 1) UI: reordenar RHF
      moveMaterial(oldIndex, newIndex);

      // 2) Persistir orden en BD (por id de requisiciones_detalle)
      try {
        const after = (getValues("materiales") || []).map((m) => m?.id).filter(Boolean);
        // Si por algún motivo no tenemos ids válidos, no persistimos.
        if (!after || after.length === 0) return;

        await persistSortOrder(after);
        toast.success("Orden de materiales actualizado.");
      } catch (e) {
        console.error("[rfq-sort] error:", e);

        // Revertir UI si falló persistencia
        try {
          moveMaterial(newIndex, oldIndex);
        } catch { }
        toast.error("No se pudo guardar el orden. Se restauró el orden anterior.");
      }
    },
    [dndIds, getValues, moveMaterial, persistSortOrder]
  );

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
            {/* =======================
                LISTA ORDENABLE
               ======================= */}
            <fieldset disabled={loading || isSaving}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={dndIds} strategy={verticalListSortingStrategy}>
                  {materialFields.map((field, index) => {
                    // Obtenemos el id real del material desde values (más confiable)
                    const mat = materialesValues[index] || field;
                    const dndId = `mat-${mat?.id ?? `idx-${index}`}`;

                    return (
                      <SortableMaterialWrapper
                        key={field.key}
                        dndId={dndId}
                        disabled={loading || isSaving}
                      >
                        {({ dragHandleProps }) => (
                          <MaterialCotizacionRow
                            control={control}
                            materialIndex={index}
                            setValue={setValue}
                            lastUsedProvider={lastUsedProvider}
                            setLastUsedProvider={setLastUsedProvider}
                            opcionesBloqueadas={requisicion?.opciones_bloqueadas || []}
                            showSku={showSku}
                            applyDownFrom={applyDownFrom}
                            dragHandleProps={dragHandleProps}
                          />
                        )}
                      </SortableMaterialWrapper>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </fieldset>

            {loading && (
              <div className="text-center p-4">
                <CircularProgress />
              </div>
            )}

            {/* Agregar Material Adicional */}
            {!loading && !isSaving && (
              <AgregarMaterialRFQ
                requisicionId={requisicionId}
                onMaterialAdded={handleMaterialAdded}
                disabled={isSaving}
              />
            )}
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
