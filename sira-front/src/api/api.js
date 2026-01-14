// C:\SIRA\sira-front\src\api\api.js
import { auth } from "../firebase/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado");
  return await user.getIdToken();
}

/**
 * request(path, { method, body, headers, responseType })
 * - Si body es FormData: NO fijar Content-Type (el navegador agrega boundary)
 * - responseType: 'json' (default) | 'blob'
 */
async function request(
  path,
  { method = "GET", body, headers = {}, responseType = "json" } = {}
) {
  const idToken = await getIdToken();

  // Construcción de headers
  const fetchHeaders = {
    Authorization: `Bearer ${idToken}`,
    ...headers,
  };

  let fetchBody = body;

  // Si el body es FormData, nos aseguramos de no mandar Content-Type
  if (body instanceof FormData) {
    // ⚠️ Muy importante: eliminar en ambos casos (mayúsculas/minúsculas)
    if ("Content-Type" in fetchHeaders) delete fetchHeaders["Content-Type"];
    if ("content-type" in fetchHeaders) delete fetchHeaders["content-type"];
    fetchBody = body;
  } else if (body !== undefined) {
    fetchHeaders["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: fetchHeaders,
    body: fetchBody,
  });

  // Manejo de errores primero
  if (!res.ok) {
    let errorPayload = null;
    try {
      errorPayload = await res.json();
    } catch {
      /* puede no ser JSON */
    }
    const msg = errorPayload?.error || `Error ${res.status} en la petición a ${path}`;
    throw { ...errorPayload, error: msg, status: res.status };
  }

  // Respuestas exitosas
  if (responseType === "blob") {
    const blob = await res.blob();
    return { data: blob, headers: res.headers };
  }

  if (res.status === 204) return null;

  try {
    return await res.json();
  } catch {
    throw new Error("La respuesta del servidor no es un JSON válido.");
  }
}

const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  put: (path, body, options) => request(path, { method: "PUT", body, ...options }),
  del: (path, body, options) => request(path, { method: "DELETE", body, ...options }),
};

export default api;
