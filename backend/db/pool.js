// C:\SIRA\backend\db\pool.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false, // Igual que en DBeaver (sin SSL)
  keepAlive: true,
  connectionTimeoutMillis: 10000
});

module.exports = pool;
