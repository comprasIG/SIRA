// C:\SIRA\sira-front\src\components\G_REQForm\utils.js
import { useState, useEffect } from "react";

/**
 * Calcula una fecha futura sumando solo días hábiles (Lunes a Viernes).
 */
export function getFutureBusinessDate(dias) {
  let count = 0;
  let futureDate = new Date();
  while (count < dias) {
    futureDate.setDate(futureDate.getDate() + 1);
    const dayOfWeek = futureDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Hook que retrasa la actualización de un valor (debounce).
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}