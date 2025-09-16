// C:\SIRA\sira-front\src\components\finanzas\pay_oc\useAutorizaciones.js

import { useState, useCallback, useEffect } from 'react';
import api from '../../../api/api';
import { toast } from 'react-toastify';

export const useAutorizaciones = () => {
    const [ocs, setOcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
    const aprobarCredito = async (ocId) => {
        try {
            toast.info("Procesando aprobación...");
            const response = await api.post(`/api/finanzas/oc/${ocId}/aprobar-credito`);
            
            // Actualización optimista de la UI:
            // Removemos la tarjeta de la lista al instante para una UX fluida.
            setOcs(prevOcs => prevOcs.filter(oc => oc.id !== ocId));

            toast.success(response.mensaje || 'OC Aprobada exitosamente.');
        } catch (err) {
            toast.error(err.error || 'No se pudo aprobar la OC.');
        }
    };

    return { ocs, loading, error, aprobarCredito, refresh: fetchOcs };
};