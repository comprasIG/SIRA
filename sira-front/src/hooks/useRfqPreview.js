import { useState, useMemo, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';

export const useRfqPreview = () => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewRfq, setPreviewRfq] = useState(null);
    const [loading, setLoading] = useState(false);

    const openPreview = useCallback(async (rfq) => {
        // rfq puede venir del dashboard con campos minimos (rfq_id, rfq_code, etc)
        // Usamos rfq_id para el fetch
        const id = rfq.rfq_id || rfq.id;

        setPreviewRfq(rfq);
        setPreviewData(null);
        setPreviewOpen(true);
        setLoading(true);
        try {
            const data = await api.get(`/api/requisiciones/${id}`);
            if (data) setPreviewData(data);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar el detalle de la Requisición.');
        } finally {
            setLoading(false);
        }
    }, []);

    const closePreview = useCallback(() => {
        setPreviewOpen(false);
        setPreviewData(null);
        setPreviewRfq(null);
        setLoading(false);
    }, []);

    const formatDate = (value) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString('es-MX', { dateStyle: 'medium' });
    };

    // Data merged for easier access
    const rfqMerged = useMemo(() => {
        if (!previewData) return previewRfq || {};
        return {
            ...previewData,
            ...previewRfq, // preserve initial info if needed
            // Ensure status comes from the backend details if available
            status: previewData.status || previewRfq?.rfq_status,
        };
    }, [previewRfq, previewData]);

    const previewMetadata = useMemo(() => {
        if (!previewData) return [];
        return [
            { label: 'Proyecto', value: previewData.proyecto },
            { label: 'Sitio', value: previewData.sitio },
            { label: 'Solicitante', value: previewData.usuario_creador },
            { label: 'Fecha Req.', value: formatDate(previewData.fecha_requerida) },
            { label: 'Departamento', value: previewData.departamento_codigo },
            { label: 'Lugar Entrega', value: previewData.lugar_entrega_nombre || previewData.lugar_entrega },
        ].filter(entry => entry.value);
    }, [previewData]);

    const previewItems = useMemo(() => {
        if (!previewData?.materiales) return [];
        return previewData.materiales.map((row) => ({
            id: row.id,
            description: row.material || row.descripcion || '-',
            sku: row.sku,
            quantity: row.cantidad,
            unit: row.unidad,
            note: row.comentario || '',
        }));
    }, [previewData]);

    const previewAttachments = useMemo(() => {
        return previewData?.adjuntos || [];
    }, [previewData]);

    const refreshPreview = useCallback(async () => {
        if (!previewRfq) return;
        const id = previewRfq.rfq_id || previewRfq.id;
        setLoading(true);
        try {
            const data = await api.get(`/api/requisiciones/${id}`);
            if (data) setPreviewData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [previewRfq]);

    return {
        previewOpen,
        previewRfq: rfqMerged,
        previewData,
        previewItems,
        previewMetadata,
        previewAttachments,
        loading,
        openPreview,
        closePreview,
        refreshPreview,
    };
};
