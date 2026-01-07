// C:\SIRA\backend\controllers\dashboard\departamentoDashboard.controller.js
/**
 * ============================================================================
 * SIRA - Dashboard por Departamento (NO Compras)
 * ----------------------------------------------------------------------------
 * FIX (2025-12-18):
 *  - En algunos entornos, loadSiraUser no expone departamento_id en req.siraUser/req.usuario.
 *  - Para no tocar middlewares, aceptamos departamento_id por querystring como fallback:
 *      GET /api/dashboard/departamento?departamento_id=1
 * ============================================================================
 */

const pool = require('../../db/pool');

function getDepartamentoIdFromRequest(req) {
  // 1) Fallback más confiable: query param (enviado por frontend)
  const fromQuery = req?.query?.departamento_id;
  if (fromQuery) return Number(fromQuery);

  // 2) Si loadSiraUser lo expone, úsalo
  const fromMiddleware =
    req?.siraUser?.departamento_id ??
    req?.siraUser?.departamentoId ??
    req?.usuario?.departamento_id ??
    req?.usuario?.departamentoId ??
    null;

  return fromMiddleware ? Number(fromMiddleware) : null;
}

const getDepartamentoDashboard = async (req, res) => {
  try {
    const departamentoId = getDepartamentoIdFromRequest(req);

    if (!departamentoId) {
      return res.status(400).json({
        error:
          'No se pudo determinar el departamento del usuario. Envia ?departamento_id=ID o revisa loadSiraUser/verifyFirebaseToken.',
      });
    }

    const query = `
      WITH rfq_base AS (
        SELECT
          r.id as rfq_id,
          r.rfq_code,
          r.status as rfq_status,
          r.departamento_id,
          s.nombre as sitio,
          s.id as sitio_id,
          p.nombre as proyecto,
          p.id as proyecto_id
        FROM requisiciones r
        JOIN sitios s ON r.sitio_id = s.id
        JOIN proyectos p ON r.proyecto_id = p.id
        WHERE r.rfq_code IS NOT NULL
          AND r.departamento_id = $1
      )
      SELECT
        rb.rfq_id,
        rb.rfq_code,
        rb.sitio,
        rb.sitio_id,
        rb.proyecto,
        rb.proyecto_id,
        rb.rfq_status,
        rb.departamento_id,
        oc.numero_oc,
        oc.status as oc_status
      FROM rfq_base rb
      LEFT JOIN ordenes_compra oc ON rb.rfq_id = oc.rfq_id
      ORDER BY rb.rfq_id DESC;
    `;

    const { rows } = await pool.query(query, [departamentoId]);

    const agrupado = rows.reduce((acc, row) => {
      if (!acc[row.rfq_id]) {
        acc[row.rfq_id] = {
          rfq_id: row.rfq_id,
          rfq_code: row.rfq_code,
          sitio: row.sitio,
          sitio_id: row.sitio_id,
          proyecto: row.proyecto,
          proyecto_id: row.proyecto_id,
          rfq_status: row.rfq_status,
          departamento_id: row.departamento_id,
          ordenes: [],
        };
      }
      if (row.numero_oc) {
        acc[row.rfq_id].ordenes.push({
          numero_oc: row.numero_oc,
          oc_status: row.oc_status,
        });
      }
      return acc;
    }, {});

    return res.json(Object.values(agrupado));
  } catch (error) {
    console.error('Error en getDepartamentoDashboard:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = { getDepartamentoDashboard };
