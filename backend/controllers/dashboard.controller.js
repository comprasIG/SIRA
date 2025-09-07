const pool = require('../db/pool');

/* =========================================================================
   UTILIDADES: ENUMS DINÁMICOS DE POSTGRESQL
   ========================================================================= */

// Obtiene el ENUM de OC de la BD, cachea en memoria
let OC_ENUM_CACHE = null;
let RFQ_ENUM_CACHE = null;

async function getOCStatusEnum() {
  if (!OC_ENUM_CACHE) {
    const result = await pool.query(
      `SELECT unnest(enum_range(NULL::orden_compra_status)) as value;`
    );
    OC_ENUM_CACHE = result.rows.map(r => r.value);
  }
  return OC_ENUM_CACHE;
}

async function getRFQStatusEnum() {
  if (!RFQ_ENUM_CACHE) {
    const result = await pool.query(
      `SELECT unnest(enum_range(NULL::requisicion_status)) as value;`
    );
    RFQ_ENUM_CACHE = result.rows.map(r => r.value);
  }
  return RFQ_ENUM_CACHE;
}

function filterValidStatus(input, validList) {
  if (!input) return null;
  if (input.includes(',')) {
    const arr = input.split(',').map(s => s.trim()).filter(Boolean);
    const filtrado = arr.filter(s => validList.includes(s));
    return filtrado.length > 0 ? filtrado : null;
  }
  return validList.includes(input) ? input : null;
}

/* =========================================================================
   ENDPOINTS
   ========================================================================= */

// Endpoint para exponer los enums válidos al frontend
const getStatusOptions = async (req, res) => {
  try {
    const ocStatus = await getOCStatusEnum();
    const rfqStatus = await getRFQStatusEnum();
    res.json({ ocStatus, rfqStatus });
  } catch (error) {
    console.error("Error al obtener enums:", error);
    res.status(500).json({ error: "Error al obtener enums de status." });
  }
};

/**
 * Devuelve los departamentos que tienen al menos una RFQ.
 */
const getDepartamentosConRfq = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        d.id,
        d.nombre,
        d.codigo
      FROM departamentos d
      JOIN requisiciones r ON d.id = r.departamento_id
      WHERE r.rfq_code IS NOT NULL
      ORDER BY d.nombre;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener departamentos con RFQ:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Dashboard principal de compras (SSD): filtra por status válidos dinámicos, departamento, sitio y proyecto.
 */
const getComprasDashboard = async (req, res) => {
  try {
    const { rfq_status, oc_status, departamento_id, sitio_id, proyecto_id } = req.query;

    // Trae los enums válidos en caliente
    const validRfqStatus = await getRFQStatusEnum();
    const validOcStatus = await getOCStatusEnum();

    // Limpia los filtros usando los enums
    const safeRfqStatus = filterValidStatus(rfq_status, validRfqStatus);
    const safeOcStatus = filterValidStatus(oc_status, validOcStatus);

    // Query principal, ahora incluye los IDs de sitio y proyecto para filtrado eficiente
    let query = `
      WITH rfq_base AS (
        SELECT
          r.id as rfq_id,
          r.rfq_code,
          s.nombre as sitio,
          s.id as sitio_id,
          p.nombre as proyecto,
          p.id as proyecto_id,
          r.status as rfq_status,
          r.departamento_id
        FROM requisiciones r
        JOIN sitios s ON r.sitio_id = s.id
        JOIN proyectos p ON r.proyecto_id = p.id
        WHERE r.rfq_code IS NOT NULL
      )
      SELECT
        rb.rfq_id,
        rb.rfq_code,
        rb.sitio,
        rb.sitio_id,
        rb.proyecto,
        rb.proyecto_id,
        rb.rfq_status,
        oc.numero_oc,
        oc.status as oc_status
      FROM rfq_base rb
      LEFT JOIN ordenes_compra oc ON rb.rfq_id = oc.rfq_id
    `;

    const conditions = [];
    const values = [];

    if (safeRfqStatus) {
      if (Array.isArray(safeRfqStatus)) {
        values.push(safeRfqStatus);
        conditions.push(`rb.rfq_status = ANY($${values.length}::requisicion_status[])`);
      } else {
        values.push(safeRfqStatus);
        conditions.push(`rb.rfq_status = $${values.length}`);
      }
    }

    if (safeOcStatus) {
      if (Array.isArray(safeOcStatus)) {
        values.push(safeOcStatus);
        conditions.push(`oc.status = ANY($${values.length}::orden_compra_status[])`);
      } else {
        values.push(safeOcStatus);
        conditions.push(`oc.status = $${values.length}`);
      }
    }

    if (departamento_id) {
      values.push(departamento_id);
      conditions.push(`rb.departamento_id = $${values.length}`);
    }

    if (sitio_id) {
      values.push(sitio_id);
      conditions.push(`rb.sitio_id = $${values.length}`);
    }

    if (proyecto_id) {
      values.push(proyecto_id);
      conditions.push(`rb.proyecto_id = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY rb.rfq_id DESC;`;

    const { rows } = await pool.query(query, values);

    // Agrupa por RFQ
    const resultadoAgrupado = rows.reduce((acc, row) => {
      if (!acc[row.rfq_id]) {
        acc[row.rfq_id] = {
          rfq_id: row.rfq_id,
          rfq_code: row.rfq_code,
          sitio: row.sitio,
          sitio_id: row.sitio_id,
          proyecto: row.proyecto,
          proyecto_id: row.proyecto_id,
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

    res.json(Object.values(resultadoAgrupado));

  } catch (error) {
    console.error("Error al obtener datos del dashboard de compras:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = {
  getComprasDashboard,
  getDepartamentosConRfq,
  getStatusOptions,
};
