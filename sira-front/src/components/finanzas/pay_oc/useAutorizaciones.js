// C:\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js

import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

export const useAutorizaciones = () => {
    const [ocs, setOcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

     const [dialogState, setDialogState] = useState({
        open: false,
        ocId: null,
        diasCredito: 0,
        fechaPago: null
    });

     const [speiDialogState, setSpeiDialogState] = useState({ open: false, ocId: null });


    // Función para obtener las OCs pendientes desde el backend
    const fetchOcs = useCallback(async () => {
        try {
            setLoading(true);
            // NOTA: Aún no creamos este endpoint, pero lo haremos.
            // Por ahora, asumimos que existe y devuelve las OCs 'POR_AUTORIZAR'.
            const data = await api.get('/api/finanzas/ocs/por-autorizar');
            setOcs(data);
        } catch (err) {
            setError('No se pudieron cargar las órdenes de compra.');
            toast.error(err.error || 'Error al cargar datos.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOcs();
    }, [fetchOcs]);

    // Función para manejar la aprobación a crédito
      const iniciarAprobacionCredito = async (ocId) => {
        try {
            // Obtenemos los días de crédito específicos de la OC
            const { dias_credito } = await api.get(`/api/finanzas/oc/${ocId}/detalles-credito`);
            
            // Calculamos la fecha de pago según la regla
            const diasParaCalculo = (dias_credito > 0) ? dias_credito : 15;
            const fechaCalculada = new Date();
            fechaCalculada.setDate(fechaCalculada.getDate() + diasParaCalculo);

            // Abrimos el diálogo con la información
            setDialogState({
                open: true,
                ocId: ocId,
                diasCredito: dias_credito,
                fechaPago: fechaCalculada
            });
        } catch (err) {
            toast.error('No se pudo obtener la información de crédito.');
        }
    };

    // --- PASO 2: Ejecutar la aprobación si el usuario confirma ---
    const confirmarAprobacionCredito = async () => {
        const { ocId } = dialogState;
        if (!ocId) return;

        try {
            toast.info("Procesando aprobación...");
            const response = await api.post(`/api/finanzas/oc/${ocId}/aprobar-credito`);
            
            setOcs(prevOcs => prevOcs.filter(oc => oc.id !== ocId));
            
            // Cerramos el diálogo ANTES de mostrar el toast de éxito
            setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });
            
            toast.success(response.mensaje || 'OC Aprobada exitosamente.');
        } catch (err) {
            toast.error(err.error || 'No se pudo aprobar la OC.');
        }
    };

    const cerrarDialogo = () => {
        setDialogState({ open: false, ocId: null, diasCredito: 0, fechaPago: null });
    };

    // --- LÓGICA PARA SPEI ---
    // 1. Pre-autoriza y abre el modal de subida
    const preautorizarSpei = async (ocId) => {
        try {
            toast.info("Preparando para pago con SPEI...");
            await api.post(`/api/finanzas/oc/${ocId}/preautorizar-spei`);
            
            // Actualizamos el estado de la OC localmente para que desaparezca de la lista
            setOcs(prevOcs => prevOcs.filter(oc => oc.id !== ocId));

            // Abrimos el diálogo para subir el archivo
            setSpeiDialogState({ open: true, ocId: ocId });

        } catch (err) {
            toast.error(err.error || 'No se pudo pre-autorizar la OC.');
        }
    };
    
    // 2. Sube el archivo y confirma la aprobación
    const confirmarSpeiConComprobante = async (ocId, archivo) => {
        const formData = new FormData();
        formData.append('comprobante', archivo);

        try {
            const response = await api.post(`/api/finanzas/oc/${ocId}/confirmar-spei`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            cerrarDialogoSpei();
            toast.success(response.mensaje || '¡OC Aprobada con SPEI exitosamente!');

        } catch (err) {
            toast.error(err.error || 'Falló la subida del comprobante.');
        }
    };
    
    const cerrarDialogoSpei = () => {
        setSpeiDialogState({ open: false, ocId: null });
    };

    return { 
        ocs, loading, error,
        // Lógica de crédito
        dialogState, iniciarAprobacionCredito, confirmarAprobacionCredito, cerrarDialogo,
        // Lógica de SPEI
        speiDialogState, preautorizarSpei, confirmarSpeiConComprobante, cerrarDialogoSpei
    };
};