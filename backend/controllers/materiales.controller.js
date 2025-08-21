// materiales.controller.js (o donde tengas la ruta)
const pool = require('../db/pool');

const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      SELECT
        m.id,
        m.nombre,
        m.unidad_de_compra,
        u.unidad AS unidad,        -- texto, p.ej. "Pieza"
        u.simbolo AS unidad_sigla  -- p.ej. "pz"
      FROM catalogo_materiales m
      JOIN catalogo_unidades u
        ON u.id = m.unidad_de_compra
      WHERE m.id = $1
    `;
    const { rows } = await pool.query(q, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Material no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error consultando material' });
  }
};

module.exports = { getMaterialById };
