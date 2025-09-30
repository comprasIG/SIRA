// C:\SIRA\backend\firebase\firebaseAdmin.js (Versión Final para ambos entornos)

const admin = require("firebase-admin");
const path = require("path");

// Si estamos en la nube (staging o producción), inicializamos sin argumentos.
if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
  console.log("🚀 Inicializando Firebase Admin para entorno de nube...");
  admin.initializeApp();
} else {
  // Si estamos en desarrollo local, usamos el archivo de credenciales.
  console.log("💻 Inicializando Firebase Admin para entorno local...");
  const serviceAccount = require(path.resolve(__dirname, "firebase-service-account.json"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;