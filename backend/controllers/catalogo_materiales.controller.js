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

const { buildSearchConditions } = require('../utils/searchUtils');

const obtenerProductos = async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    // Construcción base de la query
    let sql = `
      SELECT 
        cm.*, 
        inv.ultimo_precio_entrada, 
        inv.moneda
      FROM catalogo_materiales cm
      LEFT JOIN inventario_actual inv ON cm.id = inv.material_id
    `;

    const values = [];

    // Si hay búsqueda, generamos condiciones
    if (searchQuery && searchQuery.trim()) {
      const { whereClause, values: searchValues } = buildSearchConditions(searchQuery, 'cm.sku', 'cm.nombre', 1);

      if (whereClause) {
        // Usamos WHERE porque es la primera condición
        sql += ` WHERE 1=1 ${whereClause}`;
        values.push(...searchValues);
      }
    }

    // Ordenamiento
    sql += ` ORDER BY cm.id DESC`;

    // Limit (opcional, por ahora traemos todo si no hay paginación explicita en backend, pero el front pagina)
    // Para no romper la paginación del front que espera TODO, no ponemos LIMIT si no es búsqueda,
    // o podríamos ponerlo si el front lo soporta. Dejemoslo como estaba (traer todo) para no romper, 
    // pero filtrado si hay search.

    const result = await pool.query(sql, values);
    res.json(result.rows);

  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ error: "Error al cargar el catálogo" });
  }
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