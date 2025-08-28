// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
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

export default function G_RFQForm({ requisicionId, onBack }) {
  const [requisicion, setRequisicion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      materiales: []
    }
  });

  const formValues = watch();

  // Lógica para agrupar dinámicamente por proveedor seleccionado
  const resumenPorProveedor = useMemo(() => {
    if (!formValues.materiales) return {};
    
    const agrupado = {};
    
    formValues.materiales.forEach(material => {
      material.opciones.forEach(opcion => {
        if (opcion.seleccionado && opcion.proveedor) {
          const proveedorNombre = opcion.proveedor.nombre;
          if (!agrupado[proveedorNombre]) {
            agrupado[proveedorNombre] = [];
          }
            // 👇 CORRECCIÓN AQUÍ: Convertimos a número al crear el objeto
                    const cantidad = Number(opcion.cantidad_cotizada) || 0;
                    const precio = Number(opcion.precio_unitario) || 0;
          agrupado[proveedorNombre].push({
            material: material.material,
            cantidad: opcion.cantidad_cotizada,
            precio: opcion.precio_unitario,
            unidad: material.unidad,
            subtotal: (opcion.cantidad_cotizada || 0) * (opcion.precio_unitario || 0)
          });
        }
      });
    });
    return agrupado;
  }, [formValues]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/rfq/${requisicionId}`);
        setRequisicion(data);
        const mappedMateriales = data.materiales.map(m => ({
            ...m,
            opciones: m.opciones.length > 0 ? m.opciones.map(op => ({...op, proveedor: {id: op.proveedor_id, nombre: op.proveedor_nombre}})) : [{
                proveedor: null,
                proveedor_id: null,
                precio_unitario: '',
                cantidad_cotizada: m.cantidad, // Por defecto la cantidad total
                seleccionado: false,
                es_entrega_inmediata: true,
                es_precio_neto: false,
                es_importacion: false,
            }]
        }));
        reset({ materiales: mappedMateriales });
      } catch (err) {
        toast.error("Error al cargar los detalles de la requisición.");
      } finally {
        setLoading(false);
      }
    };
    if (requisicionId) fetchData();
  }, [requisicionId, reset]);

  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    const opcionesPayload = data.materiales.flatMap(m => 
        m.opciones
         .filter(o => o.proveedor_id) // Solo enviar las que tienen proveedor
         .map(o => ({...o, proveedor_id: o.proveedor.id, requisicion_id: requisicionId, requisicion_detalle_id: m.id}))
    );
    
    try {
        await api.post(`/api/rfq/${requisicionId}/opciones`, { opciones: opcionesPayload });
        toast.success("Comparativa guardada con éxito.");
    } catch(err) {
        toast.error(err.error || "Error al guardar la comparativa.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleEnviarAprobacion = async () => {
      await handleSubmit(onSaveSubmit)(); // Primero guarda
      if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
      try {
        await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
        toast.info("RFQ enviada a aprobación.");
        onBack();
      } catch(err) {
        toast.error(err.error || "Error al enviar a aprobación.");
      }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><CircularProgress /></div>;

  return (
    <Paper elevation={2} className="p-4 md:p-6">
      <div className="flex items-center gap-4 mb-4 border-b pb-4">
        <IconButton onClick={onBack} aria-label="Volver a la lista">
          <ArrowBackIcon />
        </IconButton>
        <div>
            <Typography variant="h5" component="h1" className="font-bold text-gray-800">
                Cotizando: {requisicion?.numero_requisicion}
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
                    />
                ))}
            </div>

            <div className="lg:col-span-1">
                <Typography variant='h6' className='mb-4'>Resumen de Compra</Typography>
                <Paper variant="outlined" className="p-4 space-y-4">
                    {Object.keys(resumenPorProveedor).length > 0 ? (
                        Object.entries(resumenPorProveedor).map(([proveedor, items]) => {
                            const totalProveedor = items.reduce((acc, item) => acc + item.subtotal, 0);
                            return (
                                <div key={proveedor}>
                                    <Typography variant='subtitle1' className='font-bold'>{proveedor}</Typography>
                                    <ul className='list-disc pl-5 text-sm'>
                                        {items.map((item, idx) => (
                                            <li key={idx}>
                                                {/* 👇 CORRECCIÓN AQUÍ: Usamos el valor numérico que ya aseguramos */}
                                                        {item.cantidad} {item.unidad} de {item.material} @ ${item.precio.toFixed(2)} = <strong>${item.subtotal.toFixed(2)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className='text-right font-bold'>Total Proveedor: ${totalProveedor.toFixed(2)}</p>
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
            <Button type="submit" variant="outlined" startIcon={<SaveIcon />} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar Borrador'}
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