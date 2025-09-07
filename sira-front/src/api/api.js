// C:\SIRA\sira-front\src\api\api.js
import { auth } from "../firebase/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado");
  return await user.getIdToken();
}

// CAMBIO: La función ahora acepta un objeto de opciones, incluyendo 'responseType'
async function request(path, { method = "GET", body, headers = {}, responseType = 'json' } = {}) {
  const idToken = await getIdToken();

  let fetchHeaders = {
    Authorization: `Bearer ${idToken}`,
    ...headers,
  };
  let fetchBody = body;

  if (!(body instanceof FormData) && body !== undefined) {
    fetchHeaders["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: fetchHeaders,
    body: fetchBody,
  });

  // Si la respuesta no es OK, manejamos el error primero.
  if (!res.ok) {
    let errorPayload = null;
    try {
      errorPayload = await res.json();
    } catch {
      // El cuerpo del error puede no ser JSON
    }
    const msg = errorPayload?.error || `Error ${res.status} en la petición a ${path}`;
    throw { ...errorPayload, error: msg, status: res.status };
  }

  // Si la respuesta es OK (2xx), procesamos el cuerpo según lo esperado.
  if (responseType === 'blob') {
    // Si esperamos un blob, lo devolvemos junto con los encabezados (para el nombre del archivo)
    const blob = await res.blob();
    return { data: blob, headers: res.headers };
  }
  
  if (res.status === 204) { // No Content
    return null;
  }
  
  // Por defecto, intentamos parsear como JSON
  try {
    return await res.json();
  } catch {
    // Si falla el parseo de JSON en una respuesta OK, puede ser un error inesperado.
    throw new Error("La respuesta del servidor no es un JSON válido.");
  }
}

// CAMBIO: Las funciones ahora aceptan un tercer parámetro 'options'
const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  put: (path, body, options) => request(path, { method: "PUT", body, ...options }),
  del: (path, body, options) => request(path, { method: "DELETE", body, ...options }),
};

export default api;