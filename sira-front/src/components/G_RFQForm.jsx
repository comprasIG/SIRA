// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
// C:\SIRA\sira-front\src\components\G_RFQForm.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { Button, CircularProgress, IconButton, Paper, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';

const calcularResumen = (materiales) => {
  if (!materiales || materiales.length === 0) return {};
  const agrupado = {};
  materiales.forEach(material => {
    if (!material || !material.opciones) return;
    material.opciones.forEach(opcion => {
      if (opcion && opcion.seleccionado && opcion.proveedor && Number(opcion.cantidad_cotizada) > 0) {
        const razonSocial = opcion.proveedor.razon_social || opcion.proveedor.nombre;
        if (!agrupado[razonSocial]) {
          agrupado[razonSocial] = [];
        }
        const cantidad = Number(opcion.cantidad_cotizada) || 0;
        const precio = Number(opcion.precio_unitario) || 0;
        agrupado[razonSocial].push({
          material: material.material,
          cantidad,
          precio,
          unidad: material.unidad,
          subtotal: cantidad * precio
        });
      }
    });
  });
  return agrupado;
};

export default function G_RFQForm({ requisicionId, onBack }) {
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [archivosOpciones, setArchivosOpciones] = useState({});

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { materiales: [] }
  });
  const formValues = watch();
  
  const resumenPorProveedor = useMemo(() => {
    if (!isDataReady) return {};
    return calcularResumen(formValues.materiales);
  }, [formValues, isDataReady]);

  useEffect(() => {
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
                ? m.opciones.map(op => ({
                    ...op,
                    precio_unitario: Number(op.precio_unitario) || 0,
                    cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
                    proveedor: {id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social}
                  })) 
                : [{
                    proveedor: null, proveedor_id: null,
                    precio_unitario: 0,
                    cantidad_cotizada: m.cantidad, 
                    seleccionado: false, es_entrega_inmediata: true,
                    es_precio_neto: false, es_importacion: false,
                }]
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

  const handleFilesChange = (materialIndex, opcionIndex, files) => {
    const uniqueKey = `${materialIndex}-${opcionIndex}`;
    setArchivosOpciones(prev => ({
        ...prev,
        [uniqueKey]: files
    }));
  };

  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const formData = new FormData();
    
    const opcionesPayload = data.materiales.flatMap(m => 
        m.opciones
         .filter(o => o.proveedor && o.proveedor.id)
         .map(o => ({...o, proveedor_id: o.proveedor.id, requisicion_id: requisicionId, requisicion_detalle_id: m.id}))
    );
    formData.append('opciones', JSON.stringify(opcionesPayload));
    formData.append('rfq_code', requisicion.rfq_code);

    data.materiales.forEach((material, matIndex) => {
        material.opciones.forEach((opcion, opIndex) => {
            if (opcion.proveedor && opcion.proveedor.id) {
                const uniqueKey = `${matIndex}-${opIndex}`;
                const archivos = archivosOpciones[uniqueKey];
                if (archivos && archivos.length > 0) {
                    archivos.forEach(file => {
                        formData.append(`cotizacion-${opcion.proveedor.id}`, file, file.name);
                    });
                }
            }
        });
    });

    try {
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("Comparativa y archivos guardados con éxito.");
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
      } catch(err) {
        toast.error(err.error || "Error al enviar a aprobación.");
      }
  };

  if (loading || !isDataReady) {
    return <div className="flex justify-center items-center h-full"><CircularProgress /></div>;
  }

  return (
    <Paper elevation={2} className="p-4 md:p-6">
      <div className="flex items-center gap-4 mb-4 border-b pb-4">
        <IconButton onClick={onBack} aria-label="Volver a la lista">
          <ArrowBackIcon />
        </IconButton>
        <div>
            <Typography variant="h5" component="h1" className="font-bold text-gray-800">
                   Cotizando: {requisicion?.rfq_code}
            </Typography>
            <Typography variant="body2" className="text-gray-500">
                {requisicion?.proyecto} / {requisicion?.sitio}
            </Typography>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(onSaveSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <Typography variant='h6'>Materiales a Cotizar</Typography>
                {formValues.materiales?.map((item, index) => (
                    <MaterialCotizacionRow
                        key={item.id || index}
                        control={control}
                        materialIndex={index}
                        setValue={setValue}
                        // --- CORRECCIÓN: Se pasa la función al componente intermedio ---
                        onFilesChange={handleFilesChange}
                    />
                ))}
            </div>
            <div className="lg:col-span-1">
                <Typography variant='h6' className='mb-4'>Resumen de Compra</Typography>
                <Paper variant="outlined" className="p-4 space-y-4">
                     <Typography variant="caption" display="block" gutterBottom>
                        <strong>Se entrega en:</strong> {requisicion?.lugar_entrega}
                    </Typography>
                    {Object.keys(resumenPorProveedor).length > 0 ? (
                        Object.entries(resumenPorProveedor).map(([proveedor, items]) => {
                            const totalProveedor = items.reduce((acc, item) => acc + (item.subtotal || 0), 0);
                            return (
                                 <div key={proveedor}>
                                    <Typography variant='subtitle1' className='font-bold'>{proveedor}</Typography>
                                    <ul className='list-disc pl-5 text-sm'>
                                        {items.map((item, idx) => (
                                            <li key={idx}>
                                                {(Number(item.cantidad) || 0)} {item.unidad} de {item.material} @ ${(Number(item.precio) || 0).toFixed(2)} = <strong>${(Number(item.subtotal) || 0).toFixed(2)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className='text-right font-bold'>Sub Total: ${(Number(totalProveedor) || 0).toFixed(2)}</p>
                                 </div>
                            );
                        })
                    ) : (
                        <Typography variant="body2" className="text-gray-500 italic">Selecciona un proveedor para cada material para ver el resumen.</Typography>
                    )}
                </Paper>
            </div>
        </div>
        <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
            <Button onClick={() => handleSubmit(onSaveSubmit)().then(() => onBack())} variant="outlined" startIcon={<SaveIcon />} disabled={isSaving}>
                 {isSaving ? 'Guardando...' : 'Guardar y Salir'}
            </Button>
            <Button
                variant="contained"
                color="primary"
                startIcon={<SendIcon />}
                onClick={handleEnviarAprobacion}
                disabled={isSaving}
            >
                Enviar a Aprobación
            </Button>
        </div>
      </form>
    </Paper>
  );
}