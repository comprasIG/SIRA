// C:\SIRA\sira-front\src\api\api.js
// src/api/api.js
// C:\SIRA\sira-front\src\api\api.js
import { auth } from "../firebase/firebase";

// Obtenemos la URL del backend desde las variables de entorno de Vite
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado");
  return await user.getIdToken();
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const idToken = await getIdToken();

  // Usamos la variable para construir la URL completa
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* puede venir 204 */ }

  if (!res.ok) {
    const msg = payload?.error || `Error ${res.status} en ${path}`;
    throw { ...payload, error: msg, status: res.status };
  }

  return payload;
}

const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path, body) => request(path, { method: "DELETE", body }),
};

export default api;