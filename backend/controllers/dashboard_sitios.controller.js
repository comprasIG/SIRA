// backend/controllers/dashboard_sitios.controller.js
const pool = require('../db/pool');

// 1. Obtener KPIs Generales
const getKpis = async (req, res) => {
  try {
    const kpis = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM clientes) as total_clientes,
        (SELECT COUNT(*) FROM sitios) as total_sitios,
        (SELECT COUNT(*) FROM proyectos WHERE activo = true) as proyectos_activos
    `);
    res.json(kpis.rows[0]);
  } catch (error) {
    console.error('Error al obtener KPIs:', error);
    res.status(500).json({ error: 'Error obteniendo KPIs' });
  }
};

// 2. Obtener Listado Completo para el Dashboard
// Corrección: Se usa LEFT JOIN y se agregan columnas al GROUP BY para compatibilidad SQL estricta
const getDashboardData = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id, 
        s.nombre, 
        s.ubicacion, 
        c.razon_social AS cliente_nombre,
        s.cliente as cliente_id,
        COUNT(DISTINCT p.id) FILTER (WHERE p.activo = true) as proyectos_activos_count,
        COALESCE(SUM(b.monto_utilizado), 0) as total_gastado
      FROM sitios s
      LEFT JOIN clientes c ON s.cliente = c.id
      LEFT JOIN proyectos p ON s.id = p.sitio_id
      LEFT JOIN budget b ON p.id = b.proyecto_id
      GROUP BY s.id, s.nombre, s.ubicacion, c.razon_social, s.cliente, c.id
      ORDER BY s.nombre ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener datos del dashboard de sitios:', error);
    res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
  }
};

// 3. Obtener Lista Simple de Clientes (Para el dropdown del modal)
const getClientesList = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, razon_social FROM clientes ORDER BY razon_social ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener lista de clientes:', error);
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
};

// 4. Crear Nuevo Sitio
const createSitio = async (req, res) => {
  // Nota: Esperamos 'cliente_id' (snake_case) desde el frontend
  const { nombre, cliente_id, ubicacion } = req.body;
  
  if (!nombre || !cliente_id || !ubicacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sitios (nombre, cliente, ubicacion) VALUES ($1, $2, $3) RETURNING *',
      [nombre, cliente_id, ubicacion]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando sitio:', error);
    if (error.code === '23505') { // Error de duplicado en Postgres
        return res.status(400).json({ error: 'Ya existe un sitio con este nombre' });
    }
    res.status(500).json({ error: 'Error creando sitio' });
  }
};

// 5. Crear Nuevo Cliente (Acción rápida)
const createCliente = async (req, res) => {
  const { razon_social, rfc } = req.body;

  if (!razon_social || !rfc) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO clientes (razon_social, rfc) VALUES ($1, $2) RETURNING *',
      [razon_social, rfc]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando cliente:', error);
    if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya existe un cliente con este RFC' });
    }
    res.status(500).json({ error: 'Error creando cliente' });
  }
};

module.exports = {
  getKpis,
  getDashboardData,
  getClientesList,
  createSitio,
  createCliente
}; 