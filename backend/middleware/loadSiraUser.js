// backend/middleware/loadSiraUser.js
const pool = require("../db/pool");

/**
 * Middleware para cargar el perfil completo del usuario desde la base de datos de SIRA
 * usando el correo verificado por Firebase.
 * Adjunta el perfil a `req.usuarioSira`.
 */
const loadSiraUser = async (req, res, next) => {
  // El correo ya fue verificado por el middleware anterior (verifyFirebaseToken)
  const correoGoogle = req.usuario?.correo_google;

  if (!correoGoogle) {
    // Esto no debería ocurrir si verifyFirebaseToken se ejecuta antes
    return res.status(401).json({ error: "Token de Firebase válido, pero sin correo electrónico." });
  }

  try {
    const userResult = await pool.query(
      'SELECT id, nombre, departamento_id, activo, es_superusuario FROM usuarios WHERE correo_google = $1 AND activo = true',
      [correoGoogle]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Usuario de Firebase autenticado, pero no autorizado o inactivo en SIRA.' });
    }

    // Adjuntamos el perfil de usuario de SIRA al objeto de la solicitud
    req.usuarioSira = userResult.rows[0];
    next();
  } catch (error) {
    console.error("Error al cargar datos del usuario SIRA:", error);
    return res.status(500).json({ error: "Error interno al verificar el usuario en SIRA." });
  }
};

module.exports = loadSiraUser;