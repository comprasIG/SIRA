// backend/controllers/dashboard_sitios.controller.js
const pool = require('../db/pool');

/* =============================================================================
   Helper: CTE para excluir el sitio UNIDADES del cliente IG BIOGAS
============================================================================= */
const CTE_SITIO_UNIDADES = `
  WITH sitio_unidades AS (
    SELECT s.id
    FROM sitios s
    JOIN clientes c ON s.cliente = c.id
    WHERE c.razon_social = 'IG BIOGAS'
      AND s.nombre = 'UNIDADES'
    LIMIT 1
  )
`;

/* =============================================================================
   1) KPIs Generales (excluyendo UNIDADES - IG BIOGAS)
============================================================================= */
const getKpis = async (req, res) => {
  try {
    const kpis = await pool.query(`
      ${CTE_SITIO_UNIDADES}
      SELECT 
        -- 1) Clientes con al menos un sitio (excluyendo UNIDADES)
        (
          SELECT COUNT(DISTINCT c.id)
          FROM clientes c
          JOIN sitios s ON s.cliente = c.id
          LEFT JOIN sitio_unidades su ON su.id = s.id
          WHERE su.id IS NULL
        ) AS total_clientes,

        -- 2) Sitios registrados (excluyendo el sitio UNIDADES)
        (
          SELECT COUNT(*)
          FROM sitios s
          LEFT JOIN sitio_unidades su ON su.id = s.id
          WHERE su.id IS NULL
        ) AS total_sitios,

        -- 3) Proyectos activos (excluyendo los del sitio UNIDADES)
        (
          SELECT COUNT(*)
          FROM proyectos p
          JOIN sitios s ON p.sitio_id = s.id
          LEFT JOIN sitio_unidades su ON su.id = s.id
          WHERE p.activo = true
            AND su.id IS NULL
        ) AS proyectos_activos
    `);

    return res.json(kpis.rows[0]);
  } catch (error) {
    console.error('Error al obtener KPIs:', error);
    return res.status(500).json({ error: 'Error obteniendo KPIs' });
  }
};

/* =============================================================================
   2) Dashboard principal de Sitios (excluye UNIDADES)
   Nota: este endpoint sigue usando budget.monto_utilizado como total_gastado.
         El total real por OC se entrega por el endpoint oc-totales-por-sitio.
============================================================================= */
const getDashboardData = async (req, res) => {
  try {
    const result = await pool.query(`
      ${CTE_SITIO_UNIDADES}
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
      LEFT JOIN sitio_unidades su ON su.id = s.id
      WHERE su.id IS NULL
      GROUP BY s.id, s.nombre, s.ubicacion, c.razon_social, s.cliente, c.id
      ORDER BY s.nombre ASC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener datos del dashboard de sitios:', error);
    return res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
  }
};

/* =============================================================================
   3) Lista simple de Clientes (para dropdowns)
============================================================================= */
const getClientesList = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, razon_social FROM clientes ORDER BY razon_social ASC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener lista de clientes:', error);
    return res.status(500).json({ error: 'Error obteniendo clientes' });
  }
};

/* =============================================================================
   4) Crear Nuevo Sitio
============================================================================= */
const createSitio = async (req, res) => {
  // Esperamos 'cliente_id' desde el frontend (snake_case)
  const { nombre, cliente_id, ubicacion } = req.body;

  if (!nombre || !cliente_id || !ubicacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sitios (nombre, cliente, ubicacion) VALUES ($1, $2, $3) RETURNING *',
      [nombre, cliente_id, ubicacion]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando sitio:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un sitio con este nombre' });
    }
    return res.status(500).json({ error: 'Error creando sitio' });
  }
};

/* =============================================================================
   5) Crear Nuevo Cliente (acción rápida)
============================================================================= */
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
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando cliente:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un cliente con este RFC' });
    }
    return res.status(500).json({ error: 'Error creando cliente' });
  }
};

/* =============================================================================
   6) Totales de OC por sitio, agrupados por moneda (SUBTOTAL exacto)
   Fuente: ordenes_compra_detalle (cantidad * precio_unitario)
   Filtro OC status: EN_PROCESO / ENTREGADA
   Excluye sitio UNIDADES (IG BIOGAS)
============================================================================= */
const getOCTotalesPorSitio = async (req, res) => {
  try {
    const result = await pool.query(`
      ${CTE_SITIO_UNIDADES}
      SELECT
        oc.sitio_id,
        ocd.moneda,
        COALESCE(SUM(ocd.cantidad * ocd.precio_unitario), 0) AS subtotal
      FROM ordenes_compra oc
      JOIN ordenes_compra_detalle ocd ON ocd.orden_compra_id = oc.id
      LEFT JOIN sitio_unidades su ON su.id = oc.sitio_id
      WHERE su.id IS NULL
        AND oc.status IN ('EN_PROCESO', 'ENTREGADA')
      GROUP BY oc.sitio_id, ocd.moneda
      ORDER BY oc.sitio_id, ocd.moneda
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo totales OC por sitio:', error);
    return res.status(500).json({ error: 'Error obteniendo totales de OC por sitio' });
  }
};

/* =============================================================================
   7) Proyectos por sitio (para modal "Ver Proyectos")
   Incluye responsable desde usuarios
   Fix: en usuarios el campo es "correo" (NO "email")
============================================================================= */
const getProyectosPorSitio = async (req, res) => {
  try {
    const { sitioId } = req.params;

    if (!sitioId) {
      return res.status(400).json({ error: 'sitioId es obligatorio' });
    }

    const result = await pool.query(
      `
      ${CTE_SITIO_UNIDADES}
      SELECT
        p.id,
        p.nombre,
        p.descripcion,
        p.activo,
        p.sitio_id,
        p.cliente_id,
        u.id AS responsable_id,
        u.nombre AS responsable_nombre,
        u.correo AS responsable_email
      FROM proyectos p
      JOIN usuarios u ON u.id = p.responsable_id
      LEFT JOIN sitio_unidades su ON su.id = p.sitio_id
      WHERE p.sitio_id = $1
        AND su.id IS NULL
      ORDER BY p.activo DESC, p.nombre ASC
      `,
      [sitioId]
    );

    return res.json(result.rows || []);
  } catch (error) {
    console.error('Error obteniendo proyectos por sitio:', error);
    return res.status(500).json({ error: 'Error obteniendo proyectos del sitio' });
  }
};

module.exports = {
  getKpis,
  getDashboardData,
  getClientesList,
  createSitio,
  createCliente,
  getOCTotalesPorSitio,
  getProyectosPorSitio,
};
