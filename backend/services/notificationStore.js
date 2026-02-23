/**
 * notificationStore.js
 * -------------------------------------------------------------------
 * In-memory store for real-time dashboard notifications.
 * Notifications expire after TTL_MS (default 3 minutes).
 * Resets on server restart – acceptable for live-dashboard use.
 */

const TTL_MS = 3 * 60 * 1000; // 3 minutes

const _store = [];

function _prune() {
  const cutoff = Date.now() - TTL_MS;
  while (_store.length && _store[0].ts < cutoff) _store.shift();
}

/**
 * Add a notification.
 * @param {{ tipo: string, titulo: string, cuerpo: string, numero_oc?: string, proveedor?: string }} payload
 */
function pushNotification({ tipo, titulo, cuerpo, numero_oc = null, proveedor = null }) {
  _prune();
  _store.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,     // 'CREDITO' | 'SPEI' | 'PAGO'
    titulo,
    cuerpo,
    numero_oc,
    proveedor,
    ts: Date.now(),
  });
}

/**
 * Returns all notifications from the last TTL_MS milliseconds.
 */
function getRecent() {
  _prune();
  return [..._store];
}

module.exports = { pushNotification, getRecent };
