// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: G_RFQForm
 * =================================================================================================
 * @file G_RFQForm.jsx
 * @description Componente principal para la pantalla de cotización (RFQ). Orquesta la carga
 * de datos, la gestión del formulario, los cálculos de resumen y el envío de toda la
 * información detallada (incluyendo finanzas y moneda) al backend.
 *
 * @props {number} requisicionId - El ID del RFQ que se va a cotizar.
 * @props {function} onBack - Callback para regresar a la vista anterior.
 */

// --- Importaciones de Librerías y Componentes ---
import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper } from '@mui/material';
import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";

// ===============================================================================================
// --- Lógica de Cálculo (Helper Function) ---
// ===============================================================================================
/**
 * @description Calcula los resúmenes de compra por proveedor. Esta lógica se comparte con
 * el componente ResumenCompra para asegurar consistencia.
 * @param {Array} materiales - El array de materiales del formulario.
 * @param {object} providerConfigs - El objeto con las configuraciones por proveedor.
 * @returns {Array} - Un arreglo con los objetos de resumen calculados.
 */
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


// ===============================================================================================
// --- Componente Principal: G_RFQForm ---
// ===============================================================================================
export default function G_RFQForm({ requisicionId, onBack }) {

  // --- Estados del Componente ---
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [archivosOpciones, setArchivosOpciones] = useState({});
  const [providerConfigs, setProviderConfigs] = useState({});
  const [lastUsedProvider, setLastUsedProvider] = useState(null);

  // --- Configuración de `react-hook-form` ---
  const { control, handleSubmit, reset, watch, setValue } = useForm({ defaultValues: { materiales: [] } });
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

        const mappedMateriales = data.materiales.map(m => ({
          ...m,
          opciones: m.opciones.length > 0
            ? m.opciones.map(op => ({
              ...op,
              precio_unitario: Number(op.precio_unitario) || '',
              cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
              proveedor: { id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social }
            }))
            : [{ proveedor: null, proveedor_id: null, precio_unitario: '', cantidad_cotizada: m.cantidad, seleccionado: false, es_entrega_inmediata: true, es_precio_neto: false, es_importacion: false }]
        }));

        reset({ materiales: mappedMateriales });
        setIsDataReady(true);
      } catch (err) {
        toast.error("Error al cargar los detalles de la requisición.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requisicionId, reset]);

  // --- Manejadores de Eventos y Lógica de Envío ---
  const handleFilesChange = (materialIndex, opcionIndex, files) => {
    const uniqueKey = `${materialIndex}-${opcionIndex}`;
    setArchivosOpciones(prev => ({ ...prev, [uniqueKey]: files }));
  };
  
  /**
   * @description Función principal para guardar el formulario.
   * Construye un payload `FormData` robusto, asegurando que todos los datos
   * financieros y de configuración sean válidos antes de enviarlos.
   */
  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const formData = new FormData();

    // --- MEJORA: Lógica de "Blindaje" para garantizar la integridad de los datos ---
    // 1. Se define una configuración por defecto.
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
    const safeProviderConfigs = { ...providerConfigs };
    
    // 2. Se identifican todos los proveedores que han sido seleccionados ("Elegir").
    const selectedProviderIds = new Set(
      data.materiales.flatMap(m => m.opciones)
        .filter(o => o.seleccionado && o.proveedor?.id)
        .map(o => o.proveedor.id)
    );

    // 3. Se asegura que cada proveedor seleccionado tenga una configuración válida.
    selectedProviderIds.forEach(id => {
      if (!safeProviderConfigs[id]) {
        safeProviderConfigs[id] = defaultConfig;
      } else if (!safeProviderConfigs[id].moneda) {
        safeProviderConfigs[id].moneda = 'MXN';
      }
    });

    // 4. Se construye el payload de OPCIONES, ahora enriquecido y seguro.
    const opcionesPayload = data.materiales.flatMap(m =>
      m.opciones.filter(o => o.proveedor && o.proveedor.id)
        .map(o => {
          const moneda = safeProviderConfigs[o.proveedor.id]?.moneda || 'MXN';
          return { ...o, proveedor_id: o.proveedor.id, requisicion_id: requisicionId, requisicion_detalle_id: m.id, moneda };
        })
    );
    formData.append('opciones', JSON.stringify(opcionesPayload));

    // 5. Se calculan y añaden los RESÚMENES usando la configuración validada.
    const resumenesPayload = calcularResumenes(data.materiales, safeProviderConfigs);
    formData.append('resumenes', JSON.stringify(resumenesPayload));
    
    // 6. Se adjuntan el código RFQ y los archivos.
    formData.append('rfq_code', requisicion.rfq_code);
    data.materiales.forEach((material, matIndex) => {
      material.opciones.forEach((opcion, opIndex) => {
        if (opcion.proveedor && opcion.proveedor.id) {
          const uniqueKey = `${matIndex}-${opIndex}`;
          const archivos = archivosOpciones[uniqueKey];
          if (archivos && archivos.length > 0) {
            archivos.forEach(file => formData.append(`cotizacion-${opcion.proveedor.id}`, file, file.name));
          }
        }
      });
    });

    // 7. Se envía la petición a la API.
    try {
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData);
      toast.success("Comparativa y detalles financieros guardados con éxito.");
    } catch (err) {
      toast.error(err.error || "Error al guardar la comparativa.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnviarAprobacion = async () => {
    await handleSubmit(onSaveSubmit)();
    if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
    try {
      await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
      toast.info("RFQ enviada a aprobación.");
      onBack();
    } catch (err) {
      toast.error(err.error || "Error al enviar a aprobación.");
    }
  };

  const handleSaveAndExit = () => {
    handleSubmit(onSaveSubmit)().then(() => onBack());
  };

  // --- Renderizado del Componente ---
  if (loading || !isDataReady) {
    return <div className="flex justify-center items-center h-full"><CircularProgress /></div>;
  }

  return (
    <Paper elevation={2} className="p-4 md:p-6">
      <RFQFormHeader onBack={onBack} rfq_code={requisicion?.rfq_code} proyecto={requisicion?.proyecto} sitio={requisicion?.sitio} />
      <form onSubmit={handleSubmit(onSaveSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {formValues.materiales?.map((item, index) => (
              <MaterialCotizacionRow
                key={item.id || index}
                control={control}
                materialIndex={index}
                setValue={setValue}
                onFilesChange={handleFilesChange}
                lastUsedProvider={lastUsedProvider}
                setLastUsedProvider={setLastUsedProvider}
              />
            ))}
          </div>
          <div className="lg:col-span-1">
            <ResumenCompra
              materiales={formValues.materiales}
              lugar_entrega={requisicion?.lugar_entrega}
              providerConfigs={providerConfigs}
              setProviderConfigs={setProviderConfigs}
            />
          </div>
        </div>
        <RFQFormActions isSaving={isSaving} onSaveAndExit={handleSaveAndExit} onSendToApproval={handleEnviarAprobacion} />
      </form>
    </Paper>
  );
}