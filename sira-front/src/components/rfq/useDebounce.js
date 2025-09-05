// C:\SIRA\sira-front\src\components\rfq\useDebounce.js
/**
 * Hook: useDebounce
 * * Propósito:
 * Retorna una versión "debounced" del valor pasado. El valor debounced solo
 * se actualizará después de que haya pasado el 'delay' especificado sin que
 * el valor original cambie.
 * * @param value El valor a "debouncear".
 * @param delay El tiempo en milisegundos a esperar.
 * @returns El valor "debounced".
 */
import { useState, useEffect } from 'react';

export default function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpieza: se ejecuta si el valor o el delay cambian antes de que pase el tiempo
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}