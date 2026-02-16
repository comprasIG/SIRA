// C:\SIRA\sira-front\src\components\G_REQForm\hooks\useInitialData.js
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/api';
import { getFutureBusinessDate } from '../utils';

const ALMACEN_ID = "21";

/**
 * Custom Hook para cargar todos los datos iniciales necesarios para el formulario de requisición.
 * @param {string|null} requisicionId - El ID de la requisición si estamos en modo edición.
 * @param {Function} reset - La función reset de react-hook-form.
 * @param {Function} setValue - La función setValue de react-hook-form.
 * @param {Function} setArchivosExistentes - Setter del estado de archivos existentes.
 * @returns {object} - Los datos cargados y el estado de carga.
 */
export function useInitialData(requisicionId, reset, setValue, setArchivosExistentes) {
  const [proyectos, setProyectos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const isEditMode = !!requisicionId;

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [proyectosData, sitiosData] = await Promise.all([
          api.get("/api/proyectos"),
          api.get("/api/sitios")
        ]);

        // Excluir sitio "UNIDADES" y sus proyectos asociados
        const sitiosFiltrados = sitiosData.filter(s => s.nombre?.toUpperCase() !== 'UNIDADES');
        const sitioUnidadesIds = new Set(
          sitiosData.filter(s => s.nombre?.toUpperCase() === 'UNIDADES').map(s => s.id)
        );
        const proyectosFiltrados = proyectosData.filter(p => !sitioUnidadesIds.has(p.sitio_id));

        setProyectos(proyectosFiltrados);
        setSitios(sitiosFiltrados);

        if (isEditMode) {
          const reqData = await api.get(`/api/requisiciones/${requisicionId}`);

          const formattedDate = new Date(reqData.fecha_requerida).toISOString().split('T')[0];

          // CAMBIO: Se utiliza directamente la información de la API para poblar el formulario.
          // La consulta del backend ya nos trae los IDs correctos.
          const mappedData = {
            proyecto_id: reqData.proyecto_id,
            sitio_id: reqData.sitio_id,
            fecha_requerida: formattedDate,
            lugar_entrega: reqData.lugar_entrega, // <-- Usamos el ID que viene de la BD
            comentario: reqData.comentario_general,
            items: reqData.materiales.map(m => ({
              material: { id: m.material_id, nombre: m.material },
              cantidad: m.cantidad,
              comentario: m.comentario,
              unidad: m.unidad,
            }))
          };
          reset(mappedData);
          setArchivosExistentes(reqData.adjuntos || []);
        } else {
          setValue('fecha_requerida', getFutureBusinessDate(5));
          setValue('lugar_entrega', ALMACEN_ID);
        }
      } catch (err) {
        toast.error("Error al cargar datos iniciales de la requisición.");
        console.error("Error en useInitialData:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [requisicionId, isEditMode, reset, setValue, setArchivosExistentes]);

  return {
    proyectos,
    sitios,
    isLoading,
  };
}