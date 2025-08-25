const pool = require("../db/pool");

const getRoles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, codigo, nombre FROM roles ORDER BY id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener roles:", error);
    res.status(500).json({ error: "Error al consultar roles" });
  }
};

module.exports = {
  getRoles,
};
