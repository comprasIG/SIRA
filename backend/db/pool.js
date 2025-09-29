// C:\SIRA\backend\db\pool.js

const { Pool } = require('pg');
require('dotenv').config();

// Objeto de configuración base
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  keepAlive: true,
  connectionTimeoutMillis: 10000
};

// --- LÓGICA CONDICIONAL ---
// Si estamos en la nube (staging o producción), usamos el socket seguro.
if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
  console.log("🚀 Conectando a Cloud SQL via Socket...");
  config.host = process.env.INSTANCE_UNIX_SOCKET; // ej. /cloudsql/proyecto:region:instancia
} else {
  // Si estamos en desarrollo local, usamos la IP/puerto.
  console.log("💻 Conectando a la base de datos localmente (TCP)...");
  config.host = process.env.DB_HOST;
  config.port = Number(process.env.DB_PORT);
  config.ssl = { rejectUnauthorized: false }; // SSL para conexión local si es necesario
}

const pool = new Pool(config);

module.exports = pool;