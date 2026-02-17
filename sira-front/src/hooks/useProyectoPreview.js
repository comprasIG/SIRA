import { useState, useEffect } from 'react';
import api from '../api/api';

/**
 * Hook to fetch detailed information of a project (summary, milestones, expenses).
 * @param {number|string|null} proyectoId - The ID of the project to fetch. If null, data is reset.
 */
export default function useProyectoPreview(proyectoId) {
    const [data, setData] = useState({ proyecto: null, hitos: [], gastos: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!proyectoId) {
            // Reset state when no ID is provided or modal is closed
            setData({ proyecto: null, hitos: [], gastos: [] });
            setLoading(false);
            setError(null);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        const fetchDetalle = async () => {
            try {
                const response = await api.get(`/api/dashboard/proyectos/${proyectoId}/detalle`);
                if (isMounted) {
                    setData(response);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error fetching project details:', err);
                    setError(err.response?.data?.error || 'Error al cargar detalles del proyecto.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchDetalle();

        return () => {
            isMounted = false;
        };
    }, [proyectoId]);

    return { ...data, loading, error };
}
