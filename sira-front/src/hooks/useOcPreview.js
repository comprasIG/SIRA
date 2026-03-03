import { useState, useMemo, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useOcPreview = () => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewOc, setPreviewOc] = useState(null);
    const [loading, setLoading] = useState(false);

    const openPreview = useCallback(async (oc) => {
        setPreviewOc(oc);
        setPreviewData(null);
        setPreviewOpen(true);
        setLoading(true);
        try {
            // Endpoint que ya existe y se usa en PAY_OC
            const data = await api.get(`/api/finanzas/oc/${oc.id}/preview`);
            if (data) setPreviewData(data);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar la previsualización de la OC.');
        } finally {
            setLoading(false);
        }
    }, []);

    const closePreview = useCallback(() => {
        setPreviewOpen(false);
        setPreviewData(null);
        setPreviewOc(null);
        setLoading(false);
    }, []);

    const formatDate = (value) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString('es-MX', { dateStyle: 'medium' });
    };

    const previewOcMerged = useMemo(() => {
        if (!previewOc && !previewData?.encabezado) return null;
        return {
            ...(previewData?.encabezado || {}),
            ...(previewOc || {}),
        };
    }, [previewOc, previewData]);

    const previewMetadata = useMemo(() => {
        const enc = previewData?.encabezado || {};
        const merged = previewOcMerged || {};
        return [
            { label: 'Proyecto', value: enc.proyecto_nombre || merged.proyecto_nombre },
            { label: 'Sitio', value: enc.sitio_nombre || merged.sitio_nombre },
            { label: 'Método de pago', value: enc.metodo_pago || merged.metodo_pago },
            { label: 'Status', value: enc.status || merged.status },
            { label: 'Fecha compromiso', value: formatDate(enc.fecha_compromiso || merged.fecha_compromiso) },
            { label: 'Fecha Aprobación', value: formatDate(enc.fecha_aprobacion_pay || merged.fecha_aprobacion_pay) },
        ].filter(entry => entry.value);
    }, [previewData, previewOcMerged]);

    const previewItems = useMemo(() => {
        const parseOrNull = (value) => {
            if (value === '' || value === null || value === undefined) return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };

        const detalle = previewData?.detalle || [];
        return detalle.map((row) => {
            const quantity = parseOrNull(row.cantidad ?? row.cantidad_pedida);
            const received = parseOrNull(row.cantidad_recibida ?? row.cantidad_facturada);
            const pending = row.cantidad_pendiente != null
                ? parseOrNull(row.cantidad_pendiente)
                : (quantity != null && received != null ? Math.max(0, quantity - received) : null);

            const price = parseOrNull(row.precio_unitario ?? row.precio);
            const total = parseOrNull(row.total_linea ?? row.total ?? ((price != null && quantity != null) ? price * quantity : null));

            return {
                id: row.id ?? row.detalle_id,
                description: row.material_nombre || row.descripcion || '-',
                sku: row.sku || '',
                quantity,
                unit: row.unidad_simbolo || row.unidad || row.unidad_medida || '',
                received,
                pending,
                price,
                currency: row.moneda || previewData?.encabezado?.moneda || previewOc?.moneda || 'MXN',
                total,
                note: row.comentario || row.observaciones || '',
            };
        });
    }, [previewData, previewOc]);

    // Resumen financiero del encabezado de la OC
    const previewFinancials = useMemo(() => {
        const enc = previewData?.encabezado || {};
        const merged = previewOcMerged || {};
        const moneda = enc.moneda || merged.moneda || 'MXN';
        const subTotal = enc.sub_total ?? merged.sub_total;
        const iva = enc.iva ?? merged.iva;
        const retIsr = enc.ret_isr ?? merged.ret_isr;
        const total = enc.total ?? merged.total;
        const ivaRate = enc.iva_rate ?? merged.iva_rate;
        const isrRate = enc.isr_rate ?? merged.isr_rate;
        const impo = enc.impo ?? merged.impo;
        const comentariosFinanzas = enc.comentarios_finanzas ?? merged.comentarios_finanzas;
        const comentario = enc.comentario ?? merged.comentario;

        return {
            moneda,
            subTotal,
            iva,
            retIsr,
            total,
            ivaRate,
            isrRate,
            impo,
            comentariosFinanzas,
            comentario,
        };
    }, [previewData, previewOcMerged]);

    return {
        previewOpen,
        previewOc: previewOcMerged,
        previewItems,
        previewMetadata,
        previewFinancials,
        loading,
        openPreview,
        closePreview,
    };
};
