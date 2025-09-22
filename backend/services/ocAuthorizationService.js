// C:\SIRA\backend\services\ocAuthorizationService.js
/**
 * Orquestador de Autorización de Órdenes de Compra
 * - Genera PDF con datos completos
 * - Sube PDF a Drive en carpeta estándar ORDENES DE COMPRA (PDF)/OC-<NUMERO_OC>
 * - Envía correo con PDF adjunto y link a la carpeta
 * - Cambia estado a APROBADA
 */
const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('./purchaseOrderPdfService');
const { uploadPdfToOcFolder, getOcFolderWebLink } = require('./googleDrive');
const { sendRequisitionEmail } = require('./emailService');

const authorizeAndDistributeOC = async (ocId, usuarioSira) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Traer datos completos para el PDF (cabecera)
    const ocQ = await client.query(`
      SELECT oc.*, 
             p.razon_social AS proveedor_razon_social, p.marca AS proveedor_marca, p.rfc AS proveedor_rfc, p.correo AS proveedor_correo,
             proy.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, u.nombre AS usuario_nombre,
             (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
             NOW() AS fecha_aprobacion
      FROM ordenes_compra oc
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN proyectos proy ON oc.proyecto_id = proy.id
      JOIN sitios s ON oc.sitio_id = s.id
      JOIN usuarios u ON oc.usuario_id = u.id
      WHERE oc.id = $1
      FOR UPDATE
    `, [ocId]);

    if (ocQ.rowCount === 0) throw new Error(`OC ${ocId} no encontrada.`);
    const ocData = ocQ.rows[0];
    if (ocData.status !== 'POR_AUTORIZAR') {
      throw new Error(`La OC ${ocData.numero_oc} está en estado '${ocData.status}' y no puede autorizarse aquí.`);
    }

    // 2) Traer detalle (ítems)
    const itemsQ = await client.query(`
      SELECT ocd.*, cm.nombre AS material_nombre, cu.simbolo AS unidad_simbolo
      FROM ordenes_compra_detalle ocd
      JOIN catalogo_materiales cm ON ocd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE ocd.orden_compra_id = $1
      ORDER BY ocd.id ASC
    `, [ocId]);
    const itemsData = itemsQ.rows;

    // 3) Generar PDF
    const pdfBuffer = await generatePurchaseOrderPdf(ocData, itemsData);
    const pdfNameSafeMarca = (ocData.proveedor_marca || 'PROV').replace(/\s+/g, '_');
    const fileName = `OC-${ocData.numero_oc}_${pdfNameSafeMarca}.pdf`;

    // 4) Subir a carpeta estándar de la OC
    const driveFile = await uploadPdfToOcFolder(pdfBuffer, ocData.numero_oc, fileName);
    const { webViewLink: folderLink } = await getOcFolderWebLink(ocData.numero_oc);

    // 5) Enviar email (internos + proveedor opcional)
    const recipients = ['compras.biogas@gmail.com'];
    if (ocData.proveedor_correo) recipients.push(ocData.proveedor_correo);

    const subject = `Orden de Compra Autorizada: ${ocData.numero_oc} – ${ocData.proveedor_razon_social}`;
    const htmlBody = `
      <p>Se autorizó la Orden de Compra <strong>${ocData.numero_oc}</strong>.</p>
      <ul>
        <li><strong>Proveedor:</strong> ${ocData.proveedor_razon_social}</li>
        <li><strong>Proyecto:</strong> ${ocData.proyecto_nombre}</li>
        <li><strong>Sitio:</strong> ${ocData.sitio_nombre}</li>
        <li><strong>Total:</strong> $${Number(ocData.total).toFixed(2)} ${ocData.moneda || ''}</li>
      </ul>
      <p>Pueden consultar la carpeta de la OC en Drive aquí: <a href="${folderLink}">${folderLink}</a></p>
      <p>Se adjunta el PDF de la OC.</p>
      <br><p><em>Correo automático SIRA</em></p>
    `;
    await sendRequisitionEmail(recipients, subject, htmlBody, pdfBuffer, fileName);

    // 6) Actualizar estado
    await client.query(
      `UPDATE ordenes_compra SET status = 'APROBADA', actualizado_en = now() WHERE id = $1`,
      [ocId]
    );

    await client.query(
      `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
       VALUES ($1, $2, $3, $4)`,
      [ocId, usuarioSira.id, 'AUTORIZACIÓN', JSON.stringify({ pdf: driveFile?.webViewLink, carpeta: folderLink })]
    );

    await client.query('COMMIT');
    return {
      mensaje: `OC ${ocData.numero_oc} autorizada y distribuida.`,
      drivePdfLink: driveFile?.webViewLink || null,
      driveFolderLink: folderLink || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth Service] Error:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { authorizeAndDistributeOC };
