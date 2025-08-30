// C:/SIRA/backend/controllers/dashboard.controller.js

const pool = require('../db/pool');

/**
 * Obtiene los datos para el dashboard de compras (SSD),
 * uniendo RFQs con sus Órdenes de Compra.
 * Acepta filtros por status de RFQ y OC.
 */
const getComprasDashboard = async (req, res) => {
  try {
    const { rfq_status, oc_status } = req.query;

    // Construcción de la consulta SQL con CTE (Common Table Expressions) para mayor claridad
    let query = `
      WITH rfq_base AS (
        SELECT
          r.id as rfq_id,
          r.rfq_code,
          s.nombre as sitio,
          p.nombre as proyecto,
          r.status as rfq_status
        FROM requisiciones r
        JOIN sitios s ON r.sitio_id = s.id
        JOIN proyectos p ON r.proyecto_id = p.id
        WHERE r.rfq_code IS NOT NULL
      )
      SELECT
        rb.rfq_id,
        rb.rfq_code,
        rb.sitio,
        rb.proyecto,
        rb.rfq_status,
        oc.numero_oc,
        oc.status as oc_status
      FROM rfq_base rb
      LEFT JOIN ordenes_compra oc ON rb.rfq_id = oc.rfq_id
    `;
    
    const conditions = [];
    const values = [];
    
    if (rfq_status) {
      values.push(rfq_status);
      conditions.push(`rb.rfq_status = $${values.length}`);
    }
    if (oc_status) {
      values.push(oc_status);
      conditions.push(`oc.status = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY rb.rfq_id DESC;`;

    const { rows } = await pool.query(query, values);

    // Agrupar resultados: un RFQ puede tener varias OCs
    const resultadoAgrupado = rows.reduce((acc, row) => {
      if (!acc[row.rfq_id]) {
        acc[row.rfq_id] = {
          rfq_id: row.rfq_id,
          rfq_code: row.rfq_code,
          sitio: row.sitio,
          proyecto: row.proyecto,
          rfq_status: row.rfq_status,
          ordenes: []
        };
      }
      if (row.numero_oc) {
        acc[row.rfq_id].ordenes.push({
          numero_oc: row.numero_oc,
          oc_status: row.oc_status
        });
      }
      return acc;
    }, {});
    
    // Convertir el objeto de vuelta a un array
    res.json(Object.values(resultadoAgrupado));

  } catch (error) {
    console.error("Error al obtener datos del dashboard de compras:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = {
  getComprasDashboard,
};