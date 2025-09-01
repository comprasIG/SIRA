const pool = require("../db/pool");

const agregarProducto = async (req, res) => {
  const {
    tipo, categoria, detalle, sku,
    unidad_de_compra, ultimo_precio,
    activo
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO catalogo_materiales 
       (tipo, categoria, detalle, sku, unidad_de_compra, ultimo_precio, activo) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [tipo, categoria, detalle, sku, unidad_de_compra, ultimo_precio, activo]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al insertar producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const obtenerProductos = async (req, res) => {
  const result = await pool.query("SELECT * FROM catalogo_materiales ORDER BY id DESC");
  res.json(result.rows);
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM catalogo_materiales WHERE id = $1", [id]);
  res.sendStatus(204);
};

const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const { tipo, categoria, detalle, sku, unidad_de_compra, ultimo_precio, activo } = req.body;
  await pool.query(
    `UPDATE catalogo_materiales SET 
     tipo = $1, categoria = $2, detalle = $3, sku = $4, 
     unidad_de_compra = $5, ultimo_precio = $6, activo = $7 
     WHERE id = $8`,
    [tipo, categoria, detalle, sku, unidad_de_compra, ultimo_precio, activo, id]
  );
  res.sendStatus(200);
};

module.exports = {
  agregarProducto,
  obtenerProductos,
  eliminarProducto,
  actualizarProducto
};