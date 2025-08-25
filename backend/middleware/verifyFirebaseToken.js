// C:\SIRA\backend\middleware\verifyFirebaseToken.js

const admin = require("../firebase/firebaseAdmin");

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.usuario = {
      correo_google: decodedToken.email,
      uid: decodedToken.uid,
      nombre: decodedToken.name,
      foto: decodedToken.picture,
    };

    next();
  } catch (error) {
    console.error("Error verificando Firebase token:", error);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

module.exports = verifyFirebaseToken;
