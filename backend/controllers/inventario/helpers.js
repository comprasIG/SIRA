// backend/controllers/inventario/helpers.js
/**
 * HELPERS / UTILIDADES GENERALES (INVENTARIOS)
 * =============================================================================
 * - Conversión de tipos para inputs (string -> number/int)
 * - Validación de superusuario
 * - Respuesta 500 estándar
 */

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const s = value.toString().trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toTrimmedString = (value) => (value ?? "").toString().trim();

const respond500 = (res, label, error, msg = "Internal Server Error.") => {
  console.error(label, error);
  return res.status(500).json({ error: msg });
};

const isSuperuser = (usuarioSira) => {
  // En tu proyecto ya usas req.usuarioSira.es_superusuario
  return !!usuarioSira?.es_superusuario;
};

module.exports = {
  toNumber,
  toInt,
  toTrimmedString,
  respond500,
  isSuperuser,
};
