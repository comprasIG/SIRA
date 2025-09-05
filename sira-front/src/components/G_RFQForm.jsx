// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * Componente: G_RFQForm
 * Propósito:
 * Formulario principal para cotizar un RFQ. Orquesta la carga de datos,
 * la gestión del estado del formulario y la interacción con los sub-componentes.
 */
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper, Typography } from '@mui/material';

import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";
// El ConfigPopover ya no se importa ni se usa aquí directamente

export default function G_RFQForm({ requisicionId, onBack }) {
  // --- Estados ---
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [archivosOpciones, setArchivosOpciones] = useState({});

  // CAMBIO: El estado de configuración ahora es un objeto que guardará configs por ID de proveedor.
  const [providerConfigs, setProviderConfigs] = useState({});

  // El estado 'lastUsedProvider' se mantiene, es necesario para la nueva funcionalidad.
  const [lastUsedProvider, setLastUsedProvider] = useState(null);

  // ELIMINADO: El estado para el popover global (anchorEl) ya no es necesario aquí.

  // --- Configuración del Formulario ---
  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { materiales: [] }
  });
  const formValues = watch(); 

  // --- Carga de Datos ---
  useEffect(() => {
    // Esta sección no ha cambiado
    const fetchData = async () => {
      if (!requisicionId) return;
      setIsDataReady(false);
      setLoading(true);
      try {
        const data = await api.get(`/api/rfq/${requisicionId}`);
        setRequisicion(data);
        const mappedMateriales = data.materiales.map(m => ({
            ...m,
            opciones: m.opciones.length > 0 
                ? m.opciones.map(op => ({ ...op, precio_unitario: Number(op.precio_unitario) || '', cantidad_cotizada: Number(op.cantidad_cotizada) || 0, proveedor: {id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social} })) 
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

  // --- Manejadores de Eventos ---

  const handleFilesChange = (materialIndex, opcionIndex, files) => {
    // Esta sección no ha cambiado
    const uniqueKey = `${materialIndex}-${opcionIndex}`;
    setArchivosOpciones(prev => ({ ...prev, [uniqueKey]: files }));
  };

  const onSaveSubmit = async (data) => {
    // Esta sección no ha cambiado
    setIsSaving(true);
    const formData = new FormData();
    const opcionesPayload = data.materiales.flatMap(m => 
        m.opciones.filter(o => o.proveedor && o.proveedor.id)
                  .map(o => ({
                      ...o, 
                      precio_unitario: Number(o.precio_unitario) || 0,
                      proveedor_id: o.proveedor.id, 
                      requisicion_id: requisicionId, 
                      requisicion_detalle_id: m.id
                    }))
    );
    formData.append('opciones', JSON.stringify(opcionesPayload));
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

    try {
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success("Comparativa y archivos guardados con éxito.");
    } catch (err) {
      toast.error(err.error || "Error al guardar la comparativa.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleEnviarAprobacion = async () => {
    // Esta sección no ha cambiado
      await handleSubmit(onSaveSubmit)();
      if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
      try {
        await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
        toast.info("RFQ enviada a aprobación.");
        onBack();
      } catch(err) {
        toast.error(err.error || "Error al enviar a aprobación.");
      }
  };

  const handleSaveAndExit = () => {
    // Esta sección no ha cambiado
      handleSubmit(onSaveSubmit)().then(() => onBack());
  };

  // ELIMINADO: Los handlers para el popover global ya no son necesarios aquí.

  // --- Renderizado ---

  if (loading || !isDataReady) {
    return <div className="flex justify-center items-center h-full"><CircularProgress /></div>;
  }

  return (
    <Paper elevation={2} className="p-4 md:p-6">
      <RFQFormHeader 
        onBack={onBack}
        rfq_code={requisicion?.rfq_code}
        proyecto={requisicion?.proyecto}
        sitio={requisicion?.sitio}
      />
      
      <form onSubmit={handleSubmit(onSaveSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna de Materiales */}
            <div className="lg:col-span-2 space-y-4">
                <Typography variant='h6'>Materiales a Cotizar</Typography>
                {formValues.materiales?.map((item, index) => (
                    <MaterialCotizacionRow
                        key={item.id || index}
                        control={control}
                        materialIndex={index}
                        setValue={setValue}
                        onFilesChange={handleFilesChange}
                        // Se siguen pasando estas props para las nuevas funcionalidades
                        lastUsedProvider={lastUsedProvider}
                        setLastUsedProvider={setLastUsedProvider}
                    />
                ))}
            </div>
            {/* Columna de Resumen */}
            <div className="lg:col-span-1">
                {/* ELIMINADO: El engrane global se quita de aquí */}
                <Typography variant='h6' className='mb-4'>Resumen de Compra</Typography>
                <ResumenCompra 
                    materiales={formValues.materiales}
                    lugar_entrega={requisicion?.lugar_entrega}
                    // CAMBIO: Pasamos el nuevo objeto de configuraciones y su 'setter'
                    providerConfigs={providerConfigs}
                    setProviderConfigs={setProviderConfigs}
                />
            </div>
        </div>
        <RFQFormActions 
            isSaving={isSaving}
            onSaveAndExit={handleSaveAndExit}
            onSendToApproval={handleEnviarAprobacion}
        />
      </form>
      
      {/* ELIMINADO: El ConfigPopover ya no se renderiza aquí */}
    </Paper>
  );
}