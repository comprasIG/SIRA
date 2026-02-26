// C:\SIRA\sira-front\src\components\rfq\useAutoSaveRFQ.js
/**
 * Hook de autosave (snapshot) para G_RFQForm.
 *
 * A diferencia de useAutoSave.js, este hook:
 * - NO maneja la carga/restauración (eso lo hace el formulario).
 * - SÓLO se encarga de guardar.
 * - Guarda ÚNICAMENTE datos generados por el usuario:
 *     - Por material: { id, opciones } — NO se guardan los campos de BD
 *       (material, sku, unidad, cantidad, etc.) ya que esos siempre vienen
 *       frescos del servidor en la carga y podrían volverse inconsistentes.
 *     - providerConfigs: configuración de IVA, moneda, etc. por proveedor.
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

  // Extrae solo los datos generados por el usuario del array de materiales
  const toUserSnapshot = (materiales) =>
    (materiales || []).map((m) => ({ id: m.id, opciones: m.opciones }));

  // 1. Vigilar 'providerConfigs' (que está en useState)
  useEffect(() => {
    if (!enabled || !requisicionId) return;

    // Cuando providerConfigs cambia, obtenemos el estado de RHF y guardamos solo datos de usuario
    const formState = getValues();
    const payload = {
      materiales: toUserSnapshot(formState.materiales),
      providerConfigs: providerConfigs,
    };
    debouncedSave(payload);

  }, [providerConfigs, enabled, requisicionId, getValues, debouncedSave]);

  // 2. Vigilar 'react-hook-form' (materiales)
  useEffect(() => {
    if (!enabled || !requisicionId) return;

    // Cuando el formulario RHF cambia, guardamos solo datos generados por el usuario
    const subscription = watch((values) => {
      const payload = {
        materiales: toUserSnapshot(values.materiales),
        providerConfigs: providerConfigs, // Siempre adjuntar el estado de configs
      };
      debouncedSave(payload);
    });

    return () => subscription.unsubscribe();
  }, [enabled, requisicionId, watch, providerConfigs, debouncedSave]);

  // Este hook no retorna nada, solo efectúa el guardado.
}