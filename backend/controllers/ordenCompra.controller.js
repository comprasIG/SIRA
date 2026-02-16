// C:\SIRA\backend\controllers\ordenCompra.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Órdenes de Compra (Descarga de PDF)
 * =================================================================================================
 * Objetivo:
 * - Descargar el PDF de una OC existente, sin alterar la lógica de guardado en BD.
 *
 * Reglas clave:
 * - numero_oc se guarda en BD como "OC-19" (NO se modifica).
 * - Presentación (PDF / nombre de archivo): padding 4 => "OC-0019", y no duplicar "OC OC-19".
 * - Nombre de archivo requerido (sin underscores):
 *     "OC-0019 - [URGENTE - ]{SITIO} - {PROYECTO} - {PROVEEDOR}.pdf"
 * - Una OC NO puede tener múltiples monedas en su detalle (validación).
 * - El correo del usuario (usuarios.correo) solo se muestra en el PDF.
 *
 * Cambios en esta versión:
 * - lugar_entrega es ID de sitios => se resuelve a nombre (sitios.nombre) como lugar_entrega_nombre
 * - filename con espacios y guiones (sin "_") y sanitizado solo para caracteres inválidos en Windows
 * - URGENTE va después del consecutivo: "OC-0019 - URGENTE - ..."
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');

/* ================================================================================================
 * Helpers
 * ==============================================================================================*/

const safeText = (v, fallback = 'N/D') => {
  const s = String(v ?? '').trim();
  return s.length ? s : fallback;
};

/**
 * Presentación uniforme: "OC-19" -> "OC-0019" / "19" -> "OC-0019" / "OC-12345" -> "OC-12345"
 */
const formatOcForDisplay = (numeroOcRaw, padDigits = 4) => {
  const raw = String(numeroOcRaw ?? '').trim();
  const match = raw.match(/(\d+)/);
  if (!match) return raw || 'OC-S/N';

  const digits = match[1];
  const padded = digits.length >= padDigits ? digits : digits.padStart(padDigits, '0');
  return `OC-${padded}`;
};

/**
 * Sanitizado mínimo:
 * - Mantiene espacios y " - " tal cual
 * - Solo reemplaza caracteres inválidos en Windows: / \ : * ? " < > |
 */
const sanitizeFileName = (s) => {
  return String(s ?? '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s/g, ' - ')
    .trim();
};

const getProveedorNombre = (oc) => {
  const razon = String(oc?.proveedor_razon_social ?? '').trim();
  if (razon) return razon;
  const marca = String(oc?.proveedor_marca ?? '').trim();
  return marca || 'PROVEEDOR';
};

/* ================================================================================================
 * Endpoint: Descargar PDF
 * ==============================================================================================*/

const descargarOcPdf = async (req, res) => {
  const { id: ocId } = req.params;

  const idNum = Number(ocId);
  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: 'Parámetro ocId inválido.' });
  }

  try {
    // 1) Traer cabecera OC + joins requeridos para PDF (incluye correo usuario y rfq_code)
    //    + lugar_entrega_nombre (sitios) a partir de oc.lugar_entrega (id)
    const ocDataQuery = await pool.query(
      `
SELECT
  oc.*,
  p.razon_social AS proveedor_razon_social,
  p.marca        AS proveedor_marca,
  p.rfc          AS proveedor_rfc,
  proy.nombre    AS proyecto_nombre,
  s.nombre       AS sitio_nombre,
  s_entrega.nombre AS lugar_entrega_nombre,
  u.nombre       AS usuario_nombre,
  u.correo       AS usuario_correo,
  r.rfq_code     AS rfq_code,
  (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
  COALESCE(oc.fecha_creacion, NOW()) AS fecha_aprobacion
FROM ordenes_compra oc
JOIN proveedores p ON oc.proveedor_id = p.id
JOIN proyectos proy ON oc.proyecto_id = proy.id
JOIN sitios s ON oc.sitio_id = s.id
LEFT JOIN sitios s_entrega ON s_entrega.id = oc.lugar_entrega::int
JOIN usuarios u ON oc.usuario_id = u.id
LEFT JOIN requisiciones r ON oc.rfq_id = r.id
WHERE oc.id = $1;
      `,
      [idNum]
    );

    if (ocDataQuery.rowCount === 0) {
      return res.status(404).json({ error: `OC ${idNum} no encontrada.` });
    }

    const ocData = ocDataQuery.rows[0];

    // 2) Validación: una OC no puede tener múltiples monedas
    const monedaDistinct = await pool.query(
      `SELECT COUNT(DISTINCT moneda)::int AS cnt
       FROM ordenes_compra_detalle
       WHERE orden_compra_id = $1`,
      [idNum]
    );

    if ((monedaDistinct.rows[0]?.cnt ?? 1) > 1) {
      return res.status(409).json({
        error: `La OC ${safeText(ocData.numero_oc)} tiene múltiples monedas en el detalle. Esto no está permitido.`
      });
    }

    // 3) Items para PDF
    const itemsDataQuery = await pool.query(
      `
      SELECT
        ocd.*,
        cm.nombre AS material_nombre,
        cm.sku    AS sku,
        cu.simbolo AS unidad_simbolo
      FROM ordenes_compra_detalle ocd
      JOIN catalogo_materiales cm ON ocd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ocd.orden_compra_id = $1
      ORDER BY ocd.id ASC;
      `,
      [idNum]
    );

    const itemsData = itemsDataQuery.rows;

    // 4) Generar PDF (servicio maneja fondo, urgente, notas, etc.)
    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData, pool);

    // 5) Nombre de archivo requerido (sin "_", con guiones y espacios)
    const ocDisplay = formatOcForDisplay(ocData.numero_oc);
    const sitio = safeText(ocData.sitio_nombre, '');
    const proyecto = safeText(ocData.proyecto_nombre, '');
    const proveedor = getProveedorNombre(ocData);

    // URGENTE después del consecutivo
    const base = `${ocDisplay} - ${sitio} - ${proyecto} - ${proveedor}`;
    const name = ocData.es_urgente === true ? `${ocDisplay} - URGENTE - ${sitio} - ${proyecto} - ${proveedor}` : base;

    const fileName = `${sanitizeFileName(name)}.pdf`;

    // 6) Respuesta
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('[ordenCompra.controller] Error al generar/servir PDF:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};

/* ================================================================================================
 * Endpoint: Listar OCs (G_OC)
 * ==============================================================================================*/
const getOcs = async (req, res) => {
  try {
    const { status, proyecto, sitio, proveedor, search, fecha_inicio, fecha_fin, exclude_status } = req.query;

    let query = `
            SELECT 
                oc.id,
                oc.numero_oc,
                oc.fecha_creacion,
                oc.total,
                (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
                oc.status,
                p.nombre AS proyecto,
                s.nombre AS sitio,
                prov.razon_social AS proveedor,
                u.nombre AS usuario_creador
            FROM ordenes_compra oc
            LEFT JOIN proyectos p ON oc.proyecto_id = p.id
            LEFT JOIN sitios s ON oc.sitio_id = s.id
            LEFT JOIN proveedores prov ON oc.proveedor_id = prov.id
            LEFT JOIN usuarios u ON oc.usuario_id = u.id
            WHERE 1=1
        `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'TODAS') {
      query += ` AND oc.status = $${paramIndex++}`;
      params.push(status);
    }

    if (exclude_status) {
      const excluded = exclude_status.split(',').map(s => s.trim());
      if (excluded.length > 0) {
        query += ` AND oc.status NOT IN (${excluded.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        params.push(...excluded);
        paramIndex += excluded.length;
      }
    }

    if (proyecto) {
      query += ` AND (p.nombre ILIKE $${paramIndex} OR CAST(oc.proyecto_id AS TEXT) = $${paramIndex})`;
      params.push(`%${proyecto}%`); // Support partial match or ID if exact
      paramIndex++;
    }

    if (sitio) {
      query += ` AND (s.nombre ILIKE $${paramIndex} OR CAST(oc.sitio_id AS TEXT) = $${paramIndex})`;
      params.push(`%${sitio}%`);
      paramIndex++;
    }

    if (proveedor) {
      query += ` AND prov.razon_social ILIKE $${paramIndex++}`;
      params.push(`%${proveedor}%`);
    }

    if (search) {
      query += ` AND (
                oc.numero_oc ILIKE $${paramIndex} OR 
                prov.razon_social ILIKE $${paramIndex} OR 
                p.nombre ILIKE $${paramIndex} OR
                CAST(oc.id AS TEXT) ILIKE $${paramIndex}
             )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (fecha_inicio) {
      query += ` AND oc.fecha_creacion >= $${paramIndex++}`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ` AND oc.fecha_creacion <= $${paramIndex++}`;
      params.push(fecha_fin);
    }

    query += ` ORDER BY oc.fecha_creacion DESC`;

    const result = await pool.query(query, params);

    // Calculate KPIs from the FULL dataset (or separated query if pagination were used)
    // For now, calculating from result is okay if result is not paginated yet.
    // Better: separate query for KPIs to always show totals regardless of filters?
    // Usually KPIs reflect the *current view* or *global state*.
    // User asked: "1 KPI que pueden ser una por cada estado... y el recuento". 
    // Let's do a quick aggregate query for the KPIs globally (or respecting static filters like project?)
    // For simplicity/performance now: calculate from the fetched list regarding the applied filters, 
    // OR fetch global stats. Let's fetch global status counts.

    const kpiQuery = `
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ENTREGADA' THEN 1 ELSE 0 END) AS entregadas,
                SUM(CASE WHEN status = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
                SUM(CASE WHEN status = 'POR_AUTORIZAR' THEN 1 ELSE 0 END) AS por_autorizar,
                SUM(CASE WHEN status NOT IN ('ENTREGADA', 'RECHAZADA', 'CANCELADA') THEN 1 ELSE 0 END) AS abiertas
            FROM ordenes_compra
        `;
    const kpiResult = await pool.query(kpiQuery);
    const kpisRaw = kpiResult.rows[0];

    const kpis = {
      total: parseInt(kpisRaw.total || 0),
      entregadas: parseInt(kpisRaw.entregadas || 0),
      rechazadas: parseInt(kpisRaw.rechazadas || 0),
      porAutorizar: parseInt(kpisRaw.por_autorizar || 0),
      abiertas: parseInt(kpisRaw.abiertas || 0)
    };

    res.json({
      ocs: result.rows,
      kpis: kpis
    });

  } catch (error) {
    console.error('Error getting OCs:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra.' });
  }
};


const getOcFilters = async (req, res) => {
  try {
    const { status, exclude_status } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'TODAS') {
      whereClause += ` AND oc.status = $${paramIndex++}`;
      params.push(status);
    }

    if (exclude_status) {
      const excluded = exclude_status.split(',').map(s => s.trim());
      if (excluded.length > 0) {
        whereClause += ` AND oc.status NOT IN (${excluded.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        params.push(...excluded);
        paramIndex += excluded.length;
      }
    }

    const proyectosQuery = `
      SELECT DISTINCT p.id, p.nombre
      FROM ordenes_compra oc
      JOIN proyectos p ON oc.proyecto_id = p.id
      ${whereClause}
      ORDER BY p.nombre
    `;

    const sitiosQuery = `
      SELECT DISTINCT s.id, s.nombre, oc.proyecto_id
      FROM ordenes_compra oc
      JOIN sitios s ON oc.sitio_id = s.id
      ${whereClause}
      ORDER BY s.nombre
    `;

    const [proyectosRes, sitiosRes] = await Promise.all([
      pool.query(proyectosQuery, params),
      pool.query(sitiosQuery, params)
    ]);

    res.json({
      proyectos: proyectosRes.rows,
      sitios: sitiosRes.rows
    });

  } catch (error) {
    console.error('Error getting OC filters:', error);
    res.status(500).json({ error: 'Error al obtener filtros.' });
  }
};

module.exports = {
  descargarOcPdf,
  getOcs,
  getOcFilters
};
