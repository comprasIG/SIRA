const pool = require('./db/pool');

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Conexión exitosa:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error de conexión:', err);
    process.exit(1);
  }
})();
