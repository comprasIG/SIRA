// C:\SIRA\backend\db\pool.js
const { Pool } = require('pg');
require('dotenv').config();


console.log("🧪 DB config desde process.env:");
console.log("HOST:", process.env.DB_HOST);
console.log("PORT:", process.env.DB_PORT);
console.log("USER:", process.env.DB_USER);
console.log("PASS:", process.env.DB_PASSWORD);
console.log("NAME:", process.env.DB_NAME);


const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
ssl: {
  rejectUnauthorized: false
},

  keepAlive: true,
  connectionTimeoutMillis: 10000
});

module.exports = pool;
