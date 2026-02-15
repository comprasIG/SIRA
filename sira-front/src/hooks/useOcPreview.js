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
            // Calculo de pendiente
            const pending = row.cantidad_pendiente != null
                ? parseOrNull(row.cantidad_pendiente)
                : (quantity != null && received != null ? Math.max(0, quantity - received) : null);

            const price = parseOrNull(row.precio_unitario ?? row.precio);
            const total = parseOrNull(row.total_linea ?? row.total ?? ((price != null && quantity != null) ? price * quantity : null));

            return {
                id: row.id ?? row.detalle_id,
                description: row.material_nombre || row.descripcion || '-',
                quantity,
                unit: row.unidad || row.unidad_medida || row.unidad_simbolo || '',
                received,
                pending,
                price,
                currency: row.moneda || previewData?.encabezado?.moneda || previewOc?.moneda || 'MXN',
                total,
                note: row.comentario || row.observaciones || '',
            };
        });
    }, [previewData, previewOc]);

    return {
        previewOpen,
        previewOc: previewOcMerged, // Devolvemos el merged para que tenga toda la info
        previewItems,
        previewMetadata,
        loading,
        openPreview,
        closePreview,
    };
};
