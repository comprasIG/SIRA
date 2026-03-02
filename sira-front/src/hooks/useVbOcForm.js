// C:\SIRA\sira-front\src\hooks\useVbOcForm.js
/**
 * =================================================================================================
 * Hook: useVbOcForm
 * =================================================================================================
 * Encapsula la lógica de estado y submit para el formulario de OC directa (/VB_OC).
 *
 * - Carga catálogos (sitios, proyectos)
 * - Maneja estado del stepper (3 pasos)
 * - Búsqueda de proveedores (reutiliza /api/proveedores?query=)
 * - Config de cálculo por proveedor (IVA/ISR)
 * - Submit → POST /api/oc-directa/crear
 * =================================================================================================
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'react-toastify';
import api from '../api/api';

const ALMACEN_ID = '21';

const defaultConfig = {
    moneda: 'MXN',
    ivaRate: '0.16',
    isIvaActive: true,
    isrRate: '0.0125',
    isIsrActive: false,
    forcedTotal: '0',
    isForcedTotalActive: false,
};

/**
 * Devuelve una fecha futura (N días hábiles)
 */
function getFutureBusinessDate(days) {
    const date = new Date();
    let added = 0;
    while (added < days) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) added++;
    }
    return date.toISOString().split('T')[0];
}

export default function useVbOcForm() {
    // --- Estado general ---
    const [activeStep, setActiveStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sitios, setSitios] = useState([]);
    const [sitiosUnidades, setSitiosUnidades] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [providerConfigs, setProviderConfigs] = useState({});

    // --- react-hook-form ---
    const form = useForm({
        defaultValues: {
            sitio_id: '',
            proyecto_id: '',
            fecha_requerida: getFutureBusinessDate(5),
            lugar_entrega: ALMACEN_ID,
            comentario: '',
            es_urgente: false,
            comentarios_finanzas: '',
            items: [
                {
                    material: null,
                    material_id: null,
                    cantidad: '',
                    unidad: '',
                    proveedor: null,
                    proveedor_id: null,
                    precio_unitario: '',
                    moneda: 'MXN',
                    es_precio_neto: false,
                    es_importacion: false,
                    es_entrega_inmediata: true,
                    tiempo_entrega: '',
                    unidad_tiempo: 'dias',
                    plazo_entrega: null,
                }
            ],
        }
    });

    const { control, handleSubmit, watch, setValue, register, formState: { errors }, trigger, getValues } = form;

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });

    // --- Proyectos filtrados por sitio ---
    const watchedSitioId = watch('sitio_id');

    const proyectosFiltrados = useMemo(() => {
        if (!watchedSitioId) return proyectos;
        return proyectos.filter(p => String(p.sitio_id) === String(watchedSitioId));
    }, [watchedSitioId, proyectos]);

    // --- Lugar de entrega options ---
    const lugarEntregaOptions = useMemo(() => {
        const options = [{ id: ALMACEN_ID, nombre: 'ALMACÉN IG' }];
        if (watchedSitioId && String(watchedSitioId) !== ALMACEN_ID) {
            const sitioSeleccionado = sitios.find(s => String(s.id) === String(watchedSitioId));
            if (sitioSeleccionado) {
                options.push({ id: sitioSeleccionado.id, nombre: sitioSeleccionado.nombre });
            }
        }
        return options;
    }, [watchedSitioId, sitios]);

    // --- Cargar datos iniciales ---
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await api.get('/api/oc-directa/datos-iniciales');
                const allSitios = data.sitios || [];
                const unidades = allSitios.filter(s => s.nombre?.toUpperCase() === 'UNIDADES');
                const sitioUnidadesIds = new Set(unidades.map(s => s.id));
                setSitios(allSitios.filter(s => !sitioUnidadesIds.has(s.id)));
                setSitiosUnidades(unidades);
                const allProyectos = data.proyectos || [];
                setProyectos(allProyectos.filter(p => !sitioUnidadesIds.has(p.sitio_id)));
            } catch (err) {
                console.error('Error cargando datos iniciales VB_OC:', err);
                toast.error('Error al cargar datos del formulario.');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // --- Agregar material ---
    const addItem = useCallback(() => {
        append({
            material: null,
            material_id: null,
            cantidad: '',
            unidad: '',
            proveedor: null,
            proveedor_id: null,
            precio_unitario: '',
            moneda: 'MXN',
            es_precio_neto: false,
            es_importacion: false,
            es_entrega_inmediata: true,
            tiempo_entrega: '',
            unidad_tiempo: 'dias',
            plazo_entrega: null,
        });
    }, [append]);

    // --- Stepper nav ---
    const handleNext = useCallback(async () => {
        if (activeStep === 0) {
            // Validar datos generales
            const valid = await trigger(['sitio_id', 'proyecto_id', 'fecha_requerida', 'lugar_entrega']);
            if (!valid) return;
        }
        if (activeStep === 1) {
            // Validar que haya al menos un material completo
            const items = getValues('items');
            const hasValidItem = items.some(it =>
                it.material_id && it.proveedor_id && it.cantidad > 0 && it.precio_unitario > 0
            );
            if (!hasValidItem) {
                toast.warn('Agrega al menos un material con proveedor y precio.');
                return;
            }
        }
        setActiveStep(prev => Math.min(prev + 1, 2));
    }, [activeStep, trigger, getValues]);

    const handleBack = useCallback(() => {
        setActiveStep(prev => Math.max(prev - 1, 0));
    }, []);

    // --- Resumen de compra (agrupado por proveedor) ---
    const watchedItems = watch('items');

    const resumenPorProveedor = useMemo(() => {
        if (!watchedItems) return [];
        const agrupado = {};

        watchedItems.forEach(item => {
            if (!item.proveedor_id || !item.material_id || !item.cantidad || !item.precio_unitario) return;

            const provId = item.proveedor_id;
            if (!agrupado[provId]) {
                agrupado[provId] = {
                    proveedorId: provId,
                    proveedorNombre: item.proveedor?.razon_social || item.proveedor?.nombre || 'Proveedor',
                    proveedorMarca: item.proveedor?.nombre || '',
                    items: [],
                };
            }

            agrupado[provId].items.push({
                material: item.material?.nombre || 'Material',
                unidad: item.unidad || '',
                cantidad: Number(item.cantidad) || 0,
                precioUnitario: Number(item.precio_unitario) || 0,
                esPrecioNeto: !!item.es_precio_neto,
                esImportacion: !!item.es_importacion,
            });
        });

        // Calcular totales
        return Object.values(agrupado).map(bloque => {
            const config = providerConfigs[bloque.proveedorId] || defaultConfig;
            const ivaRateNum = parseFloat(config.ivaRate) || 0;
            const isrRateNum = parseFloat(config.isrRate) || 0;
            const forcedTotalNum = parseFloat(config.forcedTotal) || 0;
            const esCompraImportacion = bloque.items.some(i => i.esImportacion);

            let subTotal = 0;
            const itemsConSubtotal = bloque.items.map(item => {
                let precioBase = item.precioUnitario;
                if (item.esPrecioNeto && config.isIvaActive && ivaRateNum > 0) {
                    precioBase = item.precioUnitario / (1 + ivaRateNum);
                }
                const itemSubtotal = item.cantidad * precioBase;
                subTotal += itemSubtotal;
                return { ...item, itemSubtotal };
            });

            const iva = (esCompraImportacion || !config.isIvaActive) ? 0 : subTotal * ivaRateNum;
            const retIsr = (esCompraImportacion || !config.isIsrActive) ? 0 : subTotal * isrRateNum;
            const total = config.isForcedTotalActive ? forcedTotalNum : subTotal + iva - retIsr;

            return { ...bloque, subTotal, iva, retIsr, total, esCompraImportacion, config, items: itemsConSubtotal };
        });
    }, [JSON.stringify(watchedItems), providerConfigs]);

    // --- Submit ---
    const onSubmit = useCallback(async (formData, extraPayload = {}) => {
        setIsSubmitting(true);
        try {
            // Armar items para el backend
            const itemsPayload = formData.items
                .filter(it => it.material_id && it.proveedor_id && it.cantidad > 0 && it.precio_unitario > 0)
                .map(it => ({
                    material_id: it.material_id,
                    cantidad: Number(it.cantidad),
                    proveedor_id: it.proveedor_id,
                    precio_unitario: Number(it.precio_unitario),
                    moneda: providerConfigs[it.proveedor_id]?.moneda || it.moneda || 'MXN',
                    es_precio_neto: !!it.es_precio_neto,
                    es_importacion: !!it.es_importacion,
                    plazo_entrega: it.es_entrega_inmediata
                        ? null
                        : it.tiempo_entrega ? `${it.tiempo_entrega} ${it.unidad_tiempo || 'dias'}` : null,
                }));

            if (itemsPayload.length === 0) {
                toast.warn('No hay items válidos para generar la OC.');
                return;
            }

            const payload = {
                sitio_id: Number(formData.sitio_id),
                proyecto_id: Number(formData.proyecto_id),
                lugar_entrega: formData.lugar_entrega,
                fecha_requerida: formData.fecha_requerida,
                comentario: formData.comentario || null,
                es_urgente: !!formData.es_urgente,
                comentarios_finanzas: formData.comentarios_finanzas || null,
                items: itemsPayload,
                config_por_proveedor: providerConfigs,
                ...extraPayload,
            };

            const result = await api.post('/api/oc-directa/crear', payload);
            toast.success(result?.mensaje || 'OC creada correctamente.');

            return result;
        } catch (err) {
            console.error('Error creando OC directa:', err);
            toast.error(err?.error || err?.message || 'Error al crear la OC.');
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    }, [providerConfigs]);

    return {
        // Form
        form,
        control,
        register,
        errors,
        watch,
        setValue,
        handleSubmit,

        // Field array
        fields,
        addItem,
        removeItem: remove,

        // Datos
        sitios,
        sitiosUnidades,
        proyectos,
        proyectosFiltrados,
        lugarEntregaOptions,
        isLoading,
        isSubmitting,

        // Stepper
        activeStep,
        handleNext,
        handleBack,
        setActiveStep,

        // Resumen
        resumenPorProveedor,
        providerConfigs,
        setProviderConfigs,
        defaultConfig,

        // Submit
        onSubmit,
    };
}
