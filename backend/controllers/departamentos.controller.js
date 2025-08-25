// C:\SIRA\backend\controllers\departamentos.controller.js
const pool = require("../db/pool");

const getDepartamentos = async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre, codigo FROM departamentos ORDER BY nombre");
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener departamentos:", error);
    res.status(500).json({ error: "Error al consultar departamentos" });
  }
};

module.exports = { getDepartamentos };