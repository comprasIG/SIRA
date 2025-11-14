// C:\SIRA\sira-front\src\components\G_OCForm.jsx
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { CircularProgress } from '@mui/material';

import { useAuth } from '../context/authContext';
import api from '../api/api';

import DatosGeneralesExtra from './G_OCForm/DatosGenerales';
import MaterialesSection from './G_OCForm/MaterialesSection';
import ResumenExtra from './G_OCForm/Resumen';
import AccionesExtra from './G_OCForm/Acciones';
import { useCatalogosExtraOc } from './G_OCForm/hooks/useCatalogos';
import { buildTotals, mapPayload } from './G_OCForm/utils';

const buildDefaultMaterial = () => ({
  material: null,
  descripcionManual: '',
  unidad: '',
  cantidad: '',
  precioUnitario: '',
  moneda: 'MXN',
  esImportacion: false,
  proveedor: null,
  proveedorManual: '',
  comentario: '',
});

const defaultConfiguracion = {
  aplicaIva: true,
  ivaRate: 0.16,
  esImportacion: false,
  moneda: 'MXN',
};

export default function G_OCForm() {
  const { usuario } = useAuth();
  const { catalogos, loading: loadingCatalogos, error: errorCatalogos } = useCatalogosExtraOc();
  const [submitting, setSubmitting] = useState(false);

  const defaultFecha = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }, []);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      sitioSeleccionado: null,
      sitioNombre: '',
      proyectoSeleccionado: null,
      proyectoNombre: '',
      fechaRequerida: defaultFecha,
      lugarEntrega: '',
      comentario: '',
      materiales: [buildDefaultMaterial()],
      configuracion: defaultConfiguracion,
    },
  });

  const guardarOc = async (status, values) => {
    if (!usuario) {
      toast.error('No hay usuario autenticado.');
      return;
    }

    if (!values.materiales || values.materiales.length === 0) {
      toast.error('Agrega al menos un material.');
      return;
    }

    if (values.materiales.some((mat) => !mat.descripcionManual || !mat.cantidad || !mat.precioUnitario)) {
      toast.error('Completa los datos obligatorios de los materiales.');
      return;
    }

    const { materiales: materialesPayload, datosGenerales } = mapPayload(values, usuario);
    const totales = buildTotals(values.materiales, values.configuracion || {});

    const payload = {
      usuario_id: usuario.id,
      datos_generales: datosGenerales,
      materiales: materialesPayload,
      configuraciones: values.configuracion,
      totales,
      status,
    };

    try {
      setSubmitting(true);
      const response = await api.post('/api/oc-extra', payload);
      toast.success(status === 'EN_REVISION' ? 'OC extraordinaria enviada a revisión.' : 'OC extraordinaria guardada.');
      if (status === 'BORRADOR') {
        reset({
          sitioSeleccionado: null,
          sitioNombre: '',
          proyectoSeleccionado: null,
          proyectoNombre: '',
          fechaRequerida: defaultFecha,
          lugarEntrega: '',
          comentario: '',
          materiales: [buildDefaultMaterial()],
          configuracion: defaultConfiguracion,
        });
      }
      return response;
    } catch (error) {
      console.error('[ExtraOC] Error guardando la OC extraordinaria', error);
      toast.error(error?.error || 'No fue posible guardar la OC extraordinaria.');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuardar = handleSubmit((values) => guardarOc('BORRADOR', values));
  const handleEnviar = handleSubmit((values) => guardarOc('EN_REVISION', values));

  if (loadingCatalogos) {
    return (
      <div className="flex items-center justify-center py-16">
        <CircularProgress />
      </div>
    );
  }

  if (errorCatalogos) {
    return <div className="text-red-600">{errorCatalogos}</div>;
  }

  return (
    <div className="space-y-6">
      <DatosGeneralesExtra
        register={register}
        watch={watch}
        setValue={setValue}
        errors={errors}
        catalogos={catalogos}
        loadingCatalogos={loadingCatalogos}
      />
      <MaterialesSection
        control={control}
        register={register}
        setValue={setValue}
        watch={watch}
        catalogos={catalogos}
        errors={errors}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Vista previa</h2>
          <div className="space-y-3 max-h-64 overflow-auto">
            {materiales.map((mat, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{mat.descripcionManual || 'Material sin descripción'}</span>
                  <span>{mat.moneda} ${Number(mat.precioUnitario || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{mat.cantidad} {mat.unidad}</span>
                  <span>Proveedor: {mat.proveedorManual || mat.proveedor?.nombre || 'N/D'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ResumenExtra watch={watch} setValue={setValue} />
      </div>
      <AccionesExtra onGuardar={handleGuardar} onEnviar={handleEnviar} loading={submitting} />
    </div>
  );
}
