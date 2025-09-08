// C:\SIRA\sira-front\src\components\G_RFQForm.jsx
/**
 * =================================================================================================
 * COMPONENTE: G_RFQForm
 * =================================================================================================
 * @file G_RFQForm.jsx
 * @description Este es el componente principal y orquestador para la pantalla de cotización de
 * una Solicitud de Cotización (RFQ). Se encarga de:
 * 1. Cargar los detalles del RFQ a cotizar desde la API.
 * 2. Gestionar el estado completo del formulario usando `react-hook-form`.
 * 3. Manejar la carga y asociación de archivos de cotización.
 * 4. Orquestar los sub-componentes que renderizan partes específicas del formulario.
 * 5. Enviar los datos guardados (comparativa y archivos) de vuelta al servidor.
 *
 * @props {number} requisicionId - El ID del RFQ que se va a cotizar.
 * @props {function} onBack - Callback para regresar a la vista anterior (la lista de RFQs).
 */

// --- Importaciones de Librerías y Componentes ---
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import api from "../api/api";
import { toast } from "react-toastify";
import { CircularProgress, Paper, Typography } from '@mui/material';

// --- Sub-componentes específicos del formulario ---
import MaterialCotizacionRow from './rfq/MaterialCotizacionRow';
import RFQFormHeader from "./rfq/RFQFormHeader";
import ResumenCompra from "./rfq/ResumenCompra";
import RFQFormActions from "./rfq/RFQFormActions";

export default function G_RFQForm({ requisicionId, onBack }) {

  // ===============================================================================================
  // --- Estados del Componente ---
  // ===============================================================================================

  // Almacena los datos completos del RFQ cargado desde la API.
  const [requisicion, setRequisicion] = useState(null);
  // Controla la visualización del spinner de carga principal.
  const [loading, setLoading] = useState(true);
  // Controla el estado de guardado para deshabilitar botones y dar feedback.
  const [isSaving, setIsSaving] = useState(false);
  // Flag para asegurar que el formulario no se renderice hasta que los datos iniciales estén listos.
  const [isDataReady, setIsDataReady] = useState(false);
  // Objeto para almacenar los archivos adjuntos por el usuario antes de enviarlos.
  const [archivosOpciones, setArchivosOpciones] = useState({});
  // Objeto que almacena configuraciones específicas por proveedor (ej. plazos, moneda).
  const [providerConfigs, setProviderConfigs] = useState({});
  // Guarda el último proveedor utilizado para agilizar la captura de datos.
  const [lastUsedProvider, setLastUsedProvider] = useState(null);


  // ===============================================================================================
  // --- Configuración de `react-hook-form` ---
  // ===============================================================================================

  // Inicialización del hook para gestionar el estado del formulario.
  const {
    control,      // Objeto para conectar los inputs al hook.
    handleSubmit, // Función para envolver el manejador de envío y validar.
    reset,        // Función para resetear el formulario con nuevos valores.
    watch,        // Función para observar los cambios en los campos del formulario.
    setValue      // Función para establecer el valor de un campo programáticamente.
  } = useForm({
    defaultValues: { materiales: [] } // Valor inicial del formulario.
  });

  // `watch()` sin argumentos suscribe a todos los cambios, obteniendo los valores actuales.
  const formValues = watch();


  // ===============================================================================================
  // --- Carga de Datos Inicial (Efecto) ---
  // ===============================================================================================

  useEffect(() => {
    // Función asíncrona para obtener los datos del RFQ desde el backend.
    const fetchData = async () => {
      if (!requisicionId) return; // No hacer nada si no hay ID.

      setIsDataReady(false);
      setLoading(true);
      try {
        const data = await api.get(`/api/rfq/${requisicionId}`);
        setRequisicion(data); // Guarda los datos generales del RFQ.

        // Mapea los materiales recibidos para adaptarlos a la estructura del formulario.
        const mappedMateriales = data.materiales.map(m => ({
          ...m,
          opciones: m.opciones.length > 0
            // Si ya existen opciones guardadas, se formatean.
            ? m.opciones.map(op => ({
              ...op,
              precio_unitario: Number(op.precio_unitario) || '',
              cantidad_cotizada: Number(op.cantidad_cotizada) || 0,
              proveedor: { id: op.proveedor_id, nombre: op.proveedor_nombre, razon_social: op.proveedor_razon_social }
            }))
            // Si no hay opciones, se crea una opción en blanco por defecto.
            : [{ proveedor: null, proveedor_id: null, precio_unitario: '', cantidad_cotizada: m.cantidad, seleccionado: false, es_entrega_inmediata: true, es_precio_neto: false, es_importacion: false }]
        }));

        // Resetea el formulario con los datos mapeados.
        reset({ materiales: mappedMateriales });
        setIsDataReady(true); // Marca que los datos están listos.

      } catch (err) {
        toast.error("Error al cargar los detalles de la requisición.");
      } finally {
        setLoading(false); // Oculta el spinner de carga.
      }
    };
    fetchData();
  }, [requisicionId, reset]); // Se ejecuta cada vez que el ID del RFQ cambia.


  // ===============================================================================================
  // --- Manejadores de Eventos (Handlers) ---
  // ===============================================================================================

  /**
   * Actualiza el estado `archivosOpciones` cuando el usuario adjunta o quita un archivo.
   * @param {number} materialIndex - Índice del material en el array del formulario.
   * @param {number} opcionIndex - Índice de la opción de cotización dentro del material.
   * @param {FileList} files - La lista de archivos seleccionados por el usuario.
   */
  const handleFilesChange = (materialIndex, opcionIndex, files) => {
    const uniqueKey = `${materialIndex}-${opcionIndex}`;
    setArchivosOpciones(prev => ({ ...prev, [uniqueKey]: files }));
  };

  /**
   * Función principal que se ejecuta al guardar el formulario.
   * Construye el payload `FormData` y lo envía a la API.
   * @param {object} data - Los datos actuales del formulario, proporcionados por `handleSubmit`.
   */
  const onSaveSubmit = async (data) => {
    setIsSaving(true);
    // `FormData` es necesario para enviar tanto datos JSON como archivos en una misma petición.
    const formData = new FormData();

    // 1. Prepara el payload de las opciones de cotización.
    const opcionesPayload = data.materiales.flatMap(m =>
      m.opciones.filter(o => o.proveedor && o.proveedor.id) // Solo incluye opciones con un proveedor válido.
        .map(o => ({
          ...o,
          precio_unitario: Number(o.precio_unitario) || 0,
          proveedor_id: o.proveedor.id,
          requisicion_id: requisicionId,
          requisicion_detalle_id: m.id
        }))
    );
    // Agrega el array de opciones como un string JSON al FormData.
    formData.append('opciones', JSON.stringify(opcionesPayload));
    // Agrega el código del RFQ, útil para organizar archivos en el backend.
    formData.append('rfq_code', requisicion.rfq_code);

    // 2. Agrega los archivos al FormData.
    data.materiales.forEach((material, matIndex) => {
      material.opciones.forEach((opcion, opIndex) => {
        if (opcion.proveedor && opcion.proveedor.id) {
          const uniqueKey = `${matIndex}-${opIndex}`;
          const archivos = archivosOpciones[uniqueKey];
          if (archivos && archivos.length > 0) {
            // Se nombra el campo con el ID del proveedor para agrupar archivos en el backend.
            archivos.forEach(file => formData.append(`cotizacion-${opcion.proveedor.id}`, file, file.name));
          }
        }
      });
    });

    try {
      // ########## INICIO DE LA CORRECCIÓN ##########
      //
      // Se envía el `formData` sin especificar la cabecera 'Content-Type'.
      // El navegador/axios la creará automáticamente con el 'boundary' correcto,
      // lo que soluciona el error "Multipart: Boundary not found" en el servidor.
      //
      // CÓDIGO ANTERIOR (INCORRECTO):
      // await api.post(`/api/rfq/${requisicionId}/opciones`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      //
      await api.post(`/api/rfq/${requisicionId}/opciones`, formData);
      //
      // ########## FIN DE LA CORRECCIÓN ##########

      toast.success("Comparativa y archivos guardados con éxito.");

    } catch (err) {
      toast.error(err.error || "Error al guardar la comparativa.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Guarda los cambios actuales y luego envía el RFQ al flujo de aprobación.
   */
  const handleEnviarAprobacion = async () => {
    // Primero, ejecuta la lógica de guardado.
    await handleSubmit(onSaveSubmit)();
    // Pide confirmación al usuario antes de proceder.
    if (!window.confirm("¿Estás seguro de enviar esta cotización a aprobación?")) return;
    try {
      // Llama al endpoint específico para cambiar el estado del RFQ.
      await api.post(`/api/rfq/${requisicionId}/enviar-a-aprobacion`);
      toast.info("RFQ enviada a aprobación.");
      onBack(); // Regresa a la pantalla anterior.
    } catch (err) {
      toast.error(err.error || "Error al enviar a aprobación.");
    }
  };

  /**
   * Guarda los cambios y navega de vuelta a la lista de RFQs.
   */
  const handleSaveAndExit = () => {
    handleSubmit(onSaveSubmit)().then(() => onBack());
  };


  // ===============================================================================================
  // --- Renderizado del Componente ---
  // ===============================================================================================

  // Muestra un spinner mientras los datos iniciales se están cargando.
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

          {/* Columna Principal: Lista de Materiales a Cotizar */}
          <div className="lg:col-span-2 space-y-4">
            <Typography variant='h6'>Materiales a Cotizar</Typography>
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

          {/* Columna Secundaria: Resumen de la Compra */}
          <div className="lg:col-span-1">
            <Typography variant='h6' className='mb-4'>Resumen de Compra</Typography>
            <ResumenCompra
              materiales={formValues.materiales}
              lugar_entrega={requisicion?.lugar_entrega}
              providerConfigs={providerConfigs}
              setProviderConfigs={setProviderConfigs}
            />
          </div>
        </div>

        {/* Acciones del Formulario: Botones de Guardar y Enviar */}
        <RFQFormActions
          isSaving={isSaving}
          onSaveAndExit={handleSaveAndExit}
          onSendToApproval={handleEnviarAprobacion}
        />
      </form>
    </Paper>
  );
}