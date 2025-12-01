//C:\SIRA\SIRA\backend\run-migrate.js
const { execSync } = require('child_process');
require('dotenv').config();

// Obtenemos el comando a ejecutar (ej. 'up', 'down')
const command = process.argv[2] || '';

console.log('🚀 Iniciando migración...');

try {
  // Ejecutamos el comando node-pg-migrate de forma programática
  // Pasamos las variables de entorno que ya cargó dotenv
 const output = execSync(`node-pg-migrate ${command} --no-check-order`, {
    env: {
      ...process.env, // Hereda todas las variables (incluidas las de .env)
      // Mapeamos nuestras variables DB_* a las que espera la herramienta (PG*)
      PGHOST: process.env.DB_HOST,
      PGPORT: process.env.DB_PORT,
      PGDATABASE: process.env.DB_NAME,
      PGUSER: process.env.DB_USER,
      PGPASSWORD: process.env.DB_PASSWORD,
    },
    stdio: 'inherit', // Muestra la salida del comando en nuestra terminal
  });
  console.log('✅ Migración completada con éxito.');
} catch (error) {
  console.error('❌ Error durante la migración:', error.message);
  process.exit(1); // Sale con un código de error
}

//CRERADO POR GEMENI AI