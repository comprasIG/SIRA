// --- controllers/catalogo_unidades.controller.js ---

// 1. ¡CAMBIO IMPORTANTE! Usamos 'require' para importar tu pool
// La ruta '../db/pool.js' asume que tus carpetas 'controllers' y 'db'
// están dentro de la misma carpeta 'backend'.
const pool = require('../db/pool.js');

/**
 * Función para OBTENER todas las unidades de medida desde PostgreSQL.
 */
// 2. ¡CAMBIO IMPORTANTE! Usamos 'exports.' para exportar la función
exports.getUnidades = async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM catalogo_unidades ORDER BY unidad ASC");
    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar unidades:", error.stack);
    res.status(500).json({ message: "Error interno del servidor al obtener las unidades." });
  }
};

exports.createUnidad = async (req, res) => {
  const { unidad, simbolo } = req.body;
  if (!unidad || !simbolo) {
    return res.status(400).json({ error: 'unidad y simbolo son requeridos' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO catalogo_unidades (unidad, simbolo) VALUES ($1, $2) RETURNING *',
      [unidad.toUpperCase().trim(), simbolo.toUpperCase().trim()]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error al crear unidad:", error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una unidad con ese nombre o símbolo.' });
    }
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

exports.updateUnidad = async (req, res) => {
  const { id } = req.params;
  const { unidad, simbolo } = req.body;
  if (!unidad || !simbolo) {
    return res.status(400).json({ error: 'unidad y simbolo son requeridos' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE catalogo_unidades SET unidad=$1, simbolo=$2 WHERE id=$3 RETURNING *',
      [unidad.toUpperCase().trim(), simbolo.toUpperCase().trim(), id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al actualizar unidad:", error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una unidad con ese nombre o símbolo.' });
    }
    res.status(500).json({ error: "Error interno del servidor." });
  }
};