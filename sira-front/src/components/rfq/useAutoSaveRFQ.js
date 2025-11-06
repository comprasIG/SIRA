// C:\SIRA\sira-front\src\components\rfq\useAutoSaveRFQ.js
/**
 * Hook de autosave (snapshot) para G_RFQForm.
 *
 * A diferencia de useAutoSave.js, este hook:
 * - NO maneja la carga/restauración (eso lo hace el formulario).
 * - SÓLO se encarga de guardar.
 * - Guarda el estado del formulario Y el estado de 'providerConfigs'.
 * - No necesita 'usuario' (el backend lo toma del token).
 * - No tiene 'clearDraft' (queremos mantener el snapshot).
 */
import { useEffect, useRef } from 'react';
import api from '../../api/api';

// Debounce simple
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export function useAutoSaveRFQ({
  requisicionId,
  watch,
  getValues,
  providerConfigs,
  enabled = true,
}) {
  // Usamos useRef para el debounce para no reinstanciarlo en cada render
  const debouncedSave = useRef(
    debounce(async (payload) => {
      try {
        await api.post(`/api/rfq/${requisicionId}/borrador`, { data: payload });
        // Guardado silencioso, no se notifica para no molestar al usuario
      } catch {
        // Fallo silencioso (ej. sin red)
        console.error("Fallo el autoguardado del snapshot de RFQ.");
      }
    }, 1500) // Guardar 1.5s después del último cambio
  ).current;

  // 1. Vigilar 'providerConfigs' (que está en useState)
  useEffect(() => {
    if (!enabled || !requisicionId) return;

    // Cuando providerConfigs cambia, obtenemos el estado de RHF y guardamos todo
    const formState = getValues();
    const payload = {
      materiales: formState.materiales,
      providerConfigs: providerConfigs,
    };
    debouncedSave(payload);

  }, [providerConfigs, enabled, requisicionId, getValues, debouncedSave]);

  // 2. Vigilar 'react-hook-form' (materiales)
  useEffect(() => {
    if (!enabled || !requisicionId) return;

    // Cuando el formulario RHF cambia, guardamos todo
    const subscription = watch((values) => {
      const payload = {
        materiales: values.materiales,
        providerConfigs: providerConfigs, // Siempre adjuntar el estado de configs
      };
      debouncedSave(payload);
    });

    return () => subscription.unsubscribe();
  }, [enabled, requisicionId, watch, providerConfigs, debouncedSave]);

  // Este hook no retorna nada, solo efectúa el guardado.
}