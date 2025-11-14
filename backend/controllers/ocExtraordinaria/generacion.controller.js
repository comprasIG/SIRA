// C:\SIRA\backend\controllers\ocExtraordinaria\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación de Órdenes de Compra Extraordinarias
 * =================================================================================================
 * - Expone endpoints para cargar catálogos, crear y consultar OCs extraordinarias en fase de captura.
 * - Los datos se almacenan en la tabla `ordenes_compra_extraordinarias` con estructura JSON para
 *   preservar toda la información capturada en el frontend.
 */

const pool = require('../../db/pool');

const EXTRA_OC_STATUS = {
  BORRADOR: 'BORRADOR',
  EN_REVISION: 'EN_REVISION',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
};

const _nextCodigo = async (client) => {
  const seq = await client.query(`SELECT nextval('ordenes_compra_extraordinarias_codigo_seq') AS folio`);
  const folio = seq.rows[0].folio;
  const padded = String(folio).padStart(5, '0');
  return `OCX-${padded}`;
};

const getCatalogosExtraOc = async (_req, res) => {
  try {
    const client = await pool.connect();
    try {
      const [sitios, proyectos, proveedores, unidades] = await Promise.all([
        client.query('SELECT id, nombre FROM sitios ORDER BY nombre ASC'),
        client.query(`SELECT id, nombre, sitio_id FROM proyectos WHERE activo = true ORDER BY nombre ASC`),
        client.query(`SELECT id, razon_social AS nombre FROM proveedores WHERE activo = true ORDER BY razon_social ASC`),
        client.query(`SELECT id, nombre, simbolo FROM catalogo_unidades ORDER BY nombre ASC`),
      ]);

      res.json({
        sitios: sitios.rows,
        proyectos: proyectos.rows,
        proveedores: proveedores.rows,
        unidades: unidades.rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[ExtraOC] Error al cargar catálogos:', error);
    res.status(500).json({ error: 'No fue posible obtener los catálogos para la OC extraordinaria.' });
  }
};

const crearOcExtraordinaria = async (req, res) => {
  const {
    usuario_id: usuarioId,
    datos_generales: datosGenerales,
    materiales,
    configuraciones,
    totales,
    status = EXTRA_OC_STATUS.BORRADOR,
  } = req.body || {};

  if (!usuarioId || !datosGenerales || !Array.isArray(materiales) || materiales.length === 0 || !totales) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear la OC extraordinaria.' });
  }

  const client = await pool.connect();
  try {
    const codigo = await _nextCodigo(client);
    const insertResult = await client.query(
      `INSERT INTO ordenes_compra_extraordinarias (codigo, usuario_id, status, datos_generales, materiales, configuraciones, totales)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
       RETURNING id, codigo, status, creado_en`,
      [
        codigo,
        usuarioId,
        status,
        JSON.stringify(datosGenerales),
        JSON.stringify(materiales),
        JSON.stringify(configuraciones || {}),
        JSON.stringify(totales),
      ]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error('[ExtraOC] Error al crear OC extraordinaria:', error);
    res.status(500).json({ error: 'No fue posible crear la OC extraordinaria.' });
  } finally {
    client.release();
  }
};

const obtenerOcExtraordinaria = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'OC inválida.' });

  try {
    const query = await pool.query(
      `SELECT id, codigo, usuario_id, status, datos_generales, materiales, configuraciones, totales, historial,
              creado_en, actualizado_en
         FROM ordenes_compra_extraordinarias
        WHERE id = $1`,
      [id]
    );

    if (query.rowCount === 0) {
      return res.status(404).json({ error: 'La OC extraordinaria no existe.' });
    }

    res.json(query.rows[0]);
  } catch (error) {
    console.error('[ExtraOC] Error al obtener detalle:', error);
    res.status(500).json({ error: 'No fue posible cargar la OC extraordinaria.' });
  }
};

const listarOcExtraordinarias = async (req, res) => {
  const { status } = req.query;
  try {
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = $1');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, codigo, status, datos_generales, totales, creado_en, actualizado_en
         FROM ordenes_compra_extraordinarias
         ${whereClause}
        ORDER BY creado_en DESC
        LIMIT 200`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[ExtraOC] Error al listar OCs extraordinarias:', error);
    res.status(500).json({ error: 'No fue posible listar las OCs extraordinarias.' });
  }
};

module.exports = {
  getCatalogosExtraOc,
  crearOcExtraordinaria,
  obtenerOcExtraordinaria,
  listarOcExtraordinarias,
  EXTRA_OC_STATUS,
};
