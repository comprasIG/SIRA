// backend/run-migrate.js
const { execSync } = require('child_process');
require('dotenv').config();

// comando: up | down | etc.
const command = process.argv[2] || '';

console.log('🚀 Iniciando migración...');

function isRemoteHost(host) {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return !['localhost', '127.0.0.1', '::1'].includes(h);
}

// Decide SSL:
// - Si DB_SSL=true => forzar SSL
// - Si host es remoto (no localhost) => forzar SSL (default seguro)
const DB_HOST = process.env.DB_HOST;
const forceSSL =
  String(process.env.DB_SSL || '').toLowerCase() === 'true' || isRemoteHost(DB_HOST);

// Modo SSL: require por default si es remoto (puedes override con DB_SSLMODE)
const sslmode = process.env.DB_SSLMODE || (forceSSL ? 'require' : 'disable');

// OJO: solo úsalo si tu servidor usa cert self-signed y necesitas permitirlo.
// Idealmente debería ser true (verifica cert). Default: true
const rejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

try {
  const env = {
    ...process.env,

    // Mapeo DB_* -> PG*
    PGHOST: process.env.DB_HOST,
    PGPORT: process.env.DB_PORT,
    PGDATABASE: process.env.DB_NAME,
    PGUSER: process.env.DB_USER,
    PGPASSWORD: process.env.DB_PASSWORD,

    // Para que NO tengas que escribirlo en consola
    PGSSLMODE: sslmode,
  };

  // Si estás en SSL y NO quieres validar certificado (self-signed),
  // aplicamos el equivalente a tu workaround, pero encapsulado al proceso hijo.
  if (forceSSL && !rejectUnauthorized) {
    env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  execSync(`node-pg-migrate ${command}`, {
    env,
    stdio: 'inherit',
  });

  console.log('✅ Migración completada con éxito.');
} catch (error) {
  console.error('❌ Error durante la migración:', error.message);
  process.exit(1);
}
