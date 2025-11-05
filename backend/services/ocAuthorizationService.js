// C:\SIRA\backend\services\ocAuthorizationService.js
/**
 * =================================================================================================
 * SERVICIO MAESTRO: Creación + Distribución de Órdenes de Compra (Transaccional y Consistente)
 * Versión 3.0 (CTE para numeración atómica; sin circular-require; coherencia con PDF/Drive)
 * =================================================================================================
 *
 * - Guarda en BD el campo `numero_oc` como SOLO NÚMERO (ej. "245").
 * - El encabezado del PDF y los nombres de archivo usarán el prefijo "OC-" en presentación.
 * - Se evita el desfasado entre `id` y `numero_oc` usando un CTE que llama `nextval(...)` UNA sola vez.
 * - Mantiene toda la operación en UNA transacción: BD -> PDF -> Drive -> Email.
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('./purchaseOrderPdfService');
const { uploadOcToReqFolder, downloadFileBuffer } = require('./googleDrive');
const { sendEmailWithAttachments } = require('./emailService');

/**
 * @description Obtiene los correos de un grupo de notificación.
 */
const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
  const query = `
    SELECT u.correo
    FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
  const result = await client.query(query, [codigoGrupo]);
  return result.rows.map(row => row.correo);
};

/**
 * =================================================================================================
 * FUNCIÓN PRINCIPAL
 * =================================================================================================
 * @param {object} params
 * @param {number} params.rfqId         - ID de la requisición (RFQ)
 * @param {number} params.usuarioId     - ID del usuario que genera la OC
 * @param {number[]} params.opcionIds   - IDs de las opciones (requisiciones_opciones.id)
 * @param {object} params.rfqData       - Datos auxiliares del RFQ (sitio_id, proyecto_id, lugar_entrega, depto_codigo, numero_requisicion, etc.)
 * @returns {Promise<{id:number, numero_oc:string, mensaje:string}>}
 */
const createAndAuthorizeOC = async ({ rfqId, usuarioId, opcionIds, rfqData }) => {
  if (!opcionIds || opcionIds.length === 0) {
    throw new Error("Se requiere al menos una opción seleccionada para generar la OC.");
  }

  const client = await pool.connect();

  try {
    // --- INICIO DE TRANSACCIÓN ---
    await client.query('BEGIN');

    // 1) Traer las opciones seleccionadas (verificadas contra el RFQ)
    const opcionesQuery = await client.query(
      `SELECT
          ro.*,
          rd.material_id,
          p.marca               AS proveedor_marca,
          p.razon_social        AS proveedor_razon_social,
          p.correo              AS proveedor_correo
        FROM requisiciones_opciones ro
        JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id
        JOIN proveedores p           ON ro.proveedor_id = p.id
       WHERE ro.id = ANY($1::int[]) AND ro.requisicion_id = $2`,
      [opcionIds, rfqId]
    );

    const items = opcionesQuery.rows;
    if (items.length === 0) {
      throw new Error("Las opciones seleccionadas no son válidas o no pertenecen al RFQ especificado.");
    }

    const primerItem = items[0];
    const { proveedor_id, proveedor_marca, proveedor_razon_social } = primerItem;

    // 2) Calcular totales (se respeta config_calculo si existe en las opciones)
    const subTotal = items.reduce((sum, it) => {
      const cant = Number(it.cantidad_cotizada) || 0;
      const pu   = Number(it.precio_unitario) || 0;
      return sum + (cant * pu);
    }, 0);

    const config = items[0]?.config_calculo || { isIvaActive: true, ivaRate: 0.16, isrRate: 0, isIsrActive: false };
    const iva    = (config.isIvaActive)   ? subTotal * (parseFloat(config.ivaRate) || 0.16) : 0;
    const retIsr = (config.isIsrActive)   ? subTotal * (parseFloat(config.isrRate) || 0)    : 0;
    const total  = subTotal + iva - retIsr;
    const esImportacion = items.some(i => i.es_importacion === true);

    // 3) INSERT de cabecera OC con CTE (id y numero_oc en un solo nextval)
    //    - numero_oc guarda SOLO el número (ej. "245") para evitar "OC-OC-".
    //    - id y numero_oc quedan iguales y consistentes.
    const ocInsertResult = await client.query(
      `
      WITH seq AS (SELECT nextval('ordenes_compra_id_seq') AS id)
      INSERT INTO ordenes_compra
        (id, numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega,
         sub_total, iva, total, impo, status, proveedor_id)
      SELECT
        seq.id,
        seq.id::text,
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, 'POR_AUTORIZAR', $10
      FROM seq
      RETURNING id, numero_oc
      `,
      [
        usuarioId,
        rfqId,
        rfqData.sitio_id,
        rfqData.proyecto_id,
        rfqData.lugar_entrega,
        subTotal,
        iva,
        total,
        esImportacion,
        proveedor_id
      ]
    );

    const nuevaOc = ocInsertResult.rows[0]; // { id, numero_oc } (numero_oc sin prefijo)
    const nuevaOcId = nuevaOc.id;

    // 4) Detalle de OC y actualización de líneas de requisición
    for (const it of items) {
      // Detalle
      await client.query(
        `INSERT INTO ordenes_compra_detalle
          (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          nuevaOcId,
          it.requisicion_detalle_id,
          it.id,
          it.material_id,
          it.cantidad_cotizada,
          it.precio_unitario,
          it.moneda,
          it.tiempo_entrega_valor ? `${it.tiempo_entrega_valor} ${it.tiempo_entrega_unidad}` : null
        ]
      );

      // Marcamos la línea como “comprada” con el ID de la OC (tu modelo lo usa así)
      await client.query(
        `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
        [nuevaOcId, it.requisicion_detalle_id]
      );
    }

    // 5) Generar PDF dentro de la misma transacción (el servicio acepta client)
    const pdfBuffer = await generatePurchaseOrderPdf(nuevaOcId, client);

    // Nombre de archivo “presentación”: prefijo + numero_oc (coherente con PDF)
    const pdfNameSafeMarca = (proveedor_marca || 'PROV').replace(/\s+/g, '_');
    const fileName = `OC-${nuevaOc.numero_oc}_${pdfNameSafeMarca}.pdf`;

    // 6) Subir a Drive
    const driveFile = await uploadOcToReqFolder(
      pdfBuffer,
      fileName,
      rfqData.depto_codigo,
      rfqData.numero_requisicion
    );
    if (!driveFile || !driveFile.fileLink) {
      throw new Error('Falló la subida del PDF a Drive o no se recibió el link de vuelta.');
    }

    // 7) Adjuntar respaldos de cotización (si existen)
    const quoteFilesQuery = await client.query(
      `SELECT * FROM rfq_proveedor_adjuntos WHERE proveedor_id = $1 AND requisicion_id = $2`,
      [proveedor_id, rfqId]
    );

    const attachments = [];
    attachments.push({ filename: fileName, content: pdfBuffer });

    for (const file of quoteFilesQuery.rows) {
      try {
        const fileId = file.ruta_archivo.split('/view')[0].split('/').pop();
        const fileBuffer = await downloadFileBuffer(fileId);
        attachments.push({ filename: file.nombre_archivo, content: fileBuffer });
      } catch (downloadError) {
        console.error(`No se pudo adjuntar el archivo ${file.nombre_archivo} de Drive.`, downloadError);
      }
    }

    // 8) Notificación por correo
    const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);
    if (recipients.length > 0) {
      const subject = `OC Generada para Autorización: OC-${nuevaOc.numero_oc} (${proveedor_razon_social})`;
      const htmlBody = `
        <p>Se ha generado una nueva Orden de Compra y requiere autorización final.</p>
        <p>Se adjuntan la Orden de Compra y los respaldos de la cotización.</p>
        <p>Link a Carpeta de Drive: <a href="${driveFile.folderLink}">Ver Archivos</a></p>
      `;
      await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
    }

    // --- COMMIT ---
    await client.query('COMMIT');

    return {
      ...nuevaOc, // { id, numero_oc } (sin prefijo)
      mensaje: `OC OC-${nuevaOc.numero_oc} generada y enviada.`
    };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[OC Service] Error en transacción:', err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Export compatibilidad:
 * - createAndAuthorizeOC: función principal
 * - authorizeAndDistributeOC: alias para no romper imports antiguos
 */
const authorizeAndDistributeOC = (...args) => createAndAuthorizeOC(...args);

module.exports = {
  createAndAuthorizeOC,
  authorizeAndDistributeOC
};
