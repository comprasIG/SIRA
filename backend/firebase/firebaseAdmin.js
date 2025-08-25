// C:\SIRA\backend\firebase\firebaseAdmin.js

// Importamos el SDK Admin de Firebase
const admin = require("firebase-admin");
const path = require("path");

// Ruta absoluta al archivo de service account
const serviceAccount = require(path.resolve(__dirname, "firebase-service-account.json"));

// Inicializamos Firebase Admin con la clave del backend
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
