// C:\SIRA\sira-front\src\components\G_REQForm\hooks\useAutoSave.js
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/api';

// Debounce simple
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/**
 * Hook de autosave de borradores de requisiciones:
 * - Activo solo en CREACIÓN (cuando !isEditMode)
 * - Guarda en localStorage + servidor
 * - Restaura al montar si hay borrador
 */
export function useAutoSave({
  isEditMode,
  watch,
  usuario,
  reset,
  setArchivosAdjuntos,
  setArchivosExistentes,
  enabled = true, // espera catálogos con enabled: !isLoading
}) {
  const STORAGE_KEY = usuario ? `G_REQ_DRAFT:${usuario.id}` : null;

  // 1) Restaurar borrador (server > local) al montar
  useEffect(() => {
    if (!enabled || !usuario || isEditMode) return;

    (async () => {
      try {
        // a) Local (por si el server no responde)
        const raw = STORAGE_KEY ? localStorage.getItem(STORAGE_KEY) : null;
        const localDraft = raw ? JSON.parse(raw) : null; // puede ser {data: ...} o payload directo

        // b) Servidor (preferente)
        let serverDraft = null;
        try {
          serverDraft = await api.get(`/api/requisiciones/borrador/mio?usuario_id=${usuario.id}`);
        } catch {
          /* sin borrador en server o sin red */
        }

        // c) Unificar forma del borrador
        //    - Si viene como { data: {...} }, usa .data
        //    - Si viene directo como payload, úsalo tal cual
        const envelope = serverDraft ?? localDraft ?? null;
        const payload =
          (envelope && envelope.data) ? envelope.data : envelope;

        if (payload) {
          // --- Normalización para selects: forzar IDs a string
          const cleanDraft = {
            proyecto_id:   payload.proyecto_id   != null ? String(payload.proyecto_id)   : '',
            sitio_id:      payload.sitio_id      != null ? String(payload.sitio_id)      : '',
            lugar_entrega: payload.lugar_entrega != null ? String(payload.lugar_entrega) : '',
            fecha_requerida: payload.fecha_requerida || '',
            comentario:      payload.comentario || '',
            items: (payload.items || []).map(it => ({
              material: it.material
                ? { ...it.material, id: String(it.material.id) }
                : null,
              unidad: it.unidad || '',
              cantidad: it.cantidad || '',
              comentario: it.comentario || ''
            })),
          };

          reset(cleanDraft);
          setArchivosAdjuntos?.([]);
          setArchivosExistentes?.([]);
          toast.info('Se restauró tu borrador de requisición.');
        }
      } catch {
        // silencioso
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, usuario, isEditMode]);

  // 2) Guardar (debounce) en local + servidor
  useEffect(() => {
    if (!enabled || !usuario || isEditMode) return;

    const doSave = debounce(async (formData) => {
      try {
        const payload = {
          proyecto_id: formData.proyecto_id || '',
          sitio_id: formData.sitio_id || '',
          fecha_requerida: formData.fecha_requerida || '',
          lugar_entrega: formData.lugar_entrega || '',
          comentario: formData.comentario || '',
          items: (formData.items || []).map(it => ({
            material: it.material ? { id: it.material.id, nombre: it.material.nombre } : null,
            cantidad: it.cantidad || '',
            comentario: it.comentario || '',
            unidad: it.unidad || '',
          })),
        };

        // a) Local
        if (STORAGE_KEY) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ data: payload, actualizado_en: new Date().toISOString() })
          );
        }

        // b) Servidor (best-effort)
        try {
          await api.post('/api/requisiciones/borrador', { usuario_id: usuario.id, data: payload });
        } catch {
          /* mantener silencioso para no molestar cuando no hay red */
        }
      } catch {
        /* silencioso */
      }
    }, 800);

    const subscription = watch((values) => doSave(values));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, usuario, isEditMode, watch]);

  // 3) Limpiar borrador (usar después de crear)
  const clearDraft = async () => {
    try {
      if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
      if (usuario) await api.delete('/api/requisiciones/borrador', { data: { usuario_id: usuario.id } });
    } catch {
      /* silencioso */
    }
  };

  return { clearDraft };
}
