// C:\SIRA\backend\controllers\ocExtraordinaria\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Visto Bueno de Órdenes de Compra Extraordinarias
 * =================================================================================================
 * - Gestiona los cambios de estatus (enviar, aprobar, rechazar) y la descarga de PDF.
 */

const pool = require('../../db/pool');
const { generatePurchaseOrderPdf } = require('../../services/purchaseOrderPdfService');
const { EXTRA_OC_STATUS } = require('./generacion.controller');

const _buildHistorialEntry = (usuarioId, accion, comentarios) => ({
  usuarioId,
  accion,
  comentarios: comentarios || null,
  timestamp: new Date().toISOString(),
});

const _fetchOcExtra = async (id, client = pool) => {
  const result = await client.query(
    `SELECT id, codigo, usuario_id, status, datos_generales, materiales, configuraciones, totales,
            historial, creado_en, actualizado_en
       FROM ordenes_compra_extraordinarias
      WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const _updateStatus = async ({ id, nuevoStatus, usuarioId, comentarios }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oc = await _fetchOcExtra(id, client);
    if (!oc) throw new Error('OC extraordinaria no encontrada.');

    const historialActual = Array.isArray(oc.historial) ? oc.historial : [];
    const nuevoHistorial = [...historialActual, _buildHistorialEntry(usuarioId, nuevoStatus, comentarios)];

    await client.query(
      `UPDATE ordenes_compra_extraordinarias
          SET status = $1,
              historial = $2::jsonb,
              actualizado_en = NOW()
        WHERE id = $3`,
      [nuevoStatus, JSON.stringify(nuevoHistorial), id]
    );

    await client.query('COMMIT');
    return { ...oc, status: nuevoStatus, historial: nuevoHistorial };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const enviarOcExtraARevision = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioSira?.id;

  try {
    const updated = await _updateStatus({
      id,
      nuevoStatus: EXTRA_OC_STATUS.EN_REVISION,
      usuarioId,
      comentarios: 'Envío a revisión',
    });

    res.json({ mensaje: 'OC enviada a revisión.', oc: updated });
  } catch (error) {
    console.error('[ExtraOC] Error al enviar a revisión:', error);
    res.status(500).json({ error: error.message || 'No fue posible enviar la OC extraordinaria a revisión.' });
  }
};

const aprobarOcExtra = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioSira?.id;

  try {
    const updated = await _updateStatus({
      id,
      nuevoStatus: EXTRA_OC_STATUS.APROBADA,
      usuarioId,
      comentarios: req.body?.comentarios || 'Aprobación extraordinaria',
    });

    res.json({ mensaje: 'OC extraordinaria aprobada.', oc: updated });
  } catch (error) {
    console.error('[ExtraOC] Error al aprobar:', error);
    res.status(500).json({ error: error.message || 'No fue posible aprobar la OC extraordinaria.' });
  }
};

const rechazarOcExtra = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioSira?.id;
  const comentarios = req.body?.comentarios || 'Rechazo extraordinario';

  try {
    const updated = await _updateStatus({
      id,
      nuevoStatus: EXTRA_OC_STATUS.RECHAZADA,
      usuarioId,
      comentarios,
    });

    res.json({ mensaje: 'OC extraordinaria rechazada.', oc: updated });
  } catch (error) {
    console.error('[ExtraOC] Error al rechazar:', error);
    res.status(500).json({ error: error.message || 'No fue posible rechazar la OC extraordinaria.' });
  }
};

const descargarPdfOcExtra = async (req, res) => {
  const { id } = req.params;

  try {
    const oc = await _fetchOcExtra(id);
    if (!oc) return res.status(404).json({ error: 'OC extraordinaria no encontrada.' });

    const datos = oc.datos_generales || {};
    const totales = oc.totales || {};
    const proveedor = datos.proveedor || {};
    const sitio = datos.sitio || {};
    const proyecto = datos.proyecto || {};

    const ocData = {
      numero_oc: oc.codigo,
      proveedor_razon_social: proveedor.razonSocial || proveedor.nombre || 'Proveedor extraordinario',
      proveedor_marca: proveedor.nombre || proveedor.alias || 'Proveedor',
      proveedor_rfc: proveedor.rfc || 'N/D',
      sitio_nombre: sitio.nombre || datos.sitioNombre || 'Sitio extraordinario',
      proyecto_nombre: proyecto.nombre || datos.proyectoNombre || 'Proyecto extraordinario',
      usuario_nombre: datos.solicitante?.nombre || 'Usuario SIRA',
      lugar_entrega: datos.lugarEntrega || 'Por definir',
      sub_total: Number(totales.subTotal || 0),
      iva: Number(totales.iva || 0),
      total: Number(totales.total || 0),
      impo: Boolean(totales.esImportacion),
      moneda: totales.moneda || 'MXN',
      fecha_aprobacion: oc.actualizado_en || oc.creado_en,
    };

    const items = Array.isArray(oc.materiales)
      ? oc.materiales.map((item) => ({
          material_nombre: item.material?.nombre || item.descripcion || 'Material extraordinario',
          cantidad: Number(item.cantidad || 0),
          unidad_simbolo: item.unidad || item.material?.unidad || 'N/A',
          precio_unitario: Number(item.precio_unitario || item.total_unitario || 0),
        }))
      : [];

    const pdfBuffer = await generatePurchaseOrderPdf(ocData, items);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${oc.codigo}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[ExtraOC] Error al generar PDF extraordinario:', error);
    res.status(500).json({ error: 'No fue posible generar el PDF de la OC extraordinaria.' });
  }
};

module.exports = {
  enviarOcExtraARevision,
  aprobarOcExtra,
  rechazarOcExtra,
  descargarPdfOcExtra,
};
