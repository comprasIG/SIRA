//C:\SIRA\backend\services\ocAuthorizationService.js
/**
 * =================================================================================================
 * SERVICIO: Orquestador de Autorización de Órdenes de Compra
 * =================================================================================================
 * @file ocAuthorizationService.js
 * @description Este servicio gestiona el flujo de trabajo completo para la autorización
 * de una Orden de Compra. Orquesta la generación de PDF, la subida a Google Drive,
 * el envío de notificaciones por correo y la actualización final del estado en la BD.
 */

// --- Importaciones de Servicios Dependientes ---
const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('./purchaseOrderPdfService');
const { uploadPdfBuffer } = require('./googleDrive');
const { sendRequisitionEmail } = require('./emailService'); // Reutilizamos este servicio de email

/**
 * @description Proceso completo para autorizar, registrar y distribuir una Orden de Compra.
 * @param {number} ocId - El ID de la Orden de Compra a procesar.
 * @param {object} usuarioSira - El objeto del usuario que está realizando la autorización.
 * @returns {Promise<object>} Un objeto confirmando el éxito de las operaciones.
 */
const authorizeAndDistributeOC = async (ocId, usuarioSira) => {
  const client = await pool.connect();
  try {
    // --- INICIO DE LA TRANSACCIÓN ---
    // Usamos una transacción para asegurar que si algo falla, no se actualice el estado de la OC.
    await client.query('BEGIN');

    // 1. OBTENER DATOS Y VALIDAR ESTADO
    // Obtenemos todos los datos necesarios de la OC y sus relaciones.
    const ocQuery = await client.query(`
      SELECT 
          oc.id, oc.numero_oc, oc.status, oc.rfq_id,
          r.rfq_code,
          p.marca AS proveedor_marca, p.razon_social AS proveedor_razon_social, p.correo as proveedor_correo,
          d.codigo as depto_codigo
      FROM ordenes_compra oc
      JOIN requisiciones r ON oc.rfq_id = r.id
      JOIN proveedores p ON oc.proveedor_id = p.id
      JOIN departamentos d ON r.departamento_id = d.id
      WHERE oc.id = $1;
    `, [ocId]);

    if (ocQuery.rows.length === 0) {
      throw new Error(`La Orden de Compra con ID ${ocId} no fue encontrada.`);
    }
    const ocData = ocQuery.rows[0];

    // La OC solo se puede procesar si está en 'POR_AUTORIZAR'.
    if (ocData.status !== 'POR_AUTORIZAR') {
      throw new Error(`La OC ${ocData.numero_oc} ya se encuentra en estado '${ocData.status}' y no puede ser procesada de nuevo.`);
    }
    
    // 2. GENERAR EL PDF
    console.log(`[Auth Service] Iniciando generación de PDF para OC ${ocData.numero_oc}...`);
    const pdfBuffer = await generatePurchaseOrderPdf(ocId);
    console.log(`[Auth Service] PDF generado exitosamente.`);

    // 3. SUBIR A GOOGLE DRIVE
    const fileName = `OC-${ocData.numero_oc}_${ocData.proveedor_marca}.pdf`;
    console.log(`[Auth Service] Subiendo archivo "${fileName}" a Google Drive...`);
    const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, ocData.depto_codigo, ocData.rfq_code);
    console.log(`[Auth Service] Archivo subido a Drive. Link: ${driveFile.webViewLink}`);

    // 4. ENVIAR NOTIFICACIÓN POR CORREO
    // Preparamos los detalles para el envío del correo.
    const recipients = ['compras.biogas@gmail.com']; // Lista de destinatarios internos
    if (ocData.proveedor_correo) {
      recipients.push(ocData.proveedor_correo); // Opcionalmente, se añade el correo del proveedor
    }
    const subject = `Nueva Orden de Compra Autorizada: ${ocData.numero_oc} para ${ocData.proveedor_razon_social}`;
    const htmlBody = `
      <p>Estimados,</p>
      <p>Se ha autorizado una nueva Orden de Compra. Por favor, encuentren el documento PDF adjunto para su gestión.</p>
      <ul>
        <li><strong>Número de OC:</strong> ${ocData.numero_oc}</li>
        <li><strong>Proveedor:</strong> ${ocData.proveedor_razon_social}</li>
        <li><strong>RFQ de Origen:</strong> ${ocData.rfq_code}</li>
        <li><strong>Autorizado por:</strong> ${usuarioSira.nombre}</li>
      </ul>
      <p>Pueden acceder al archivo directamente en Google Drive a través de este <a href="${driveFile.webViewLink}">enlace</a>.</p>
      <br>
      <p><em>Este es un correo generado automáticamente por el sistema SIRA.</em></p>
    `;
    console.log(`[Auth Service] Enviando correo a: ${recipients.join(', ')}...`);
    await sendRequisitionEmail(recipients, subject, htmlBody, pdfBuffer, fileName);
    console.log(`[Auth Service] Correo enviado.`);

    // 5. ACTUALIZAR ESTADO EN LA BASE DE DATOS
    // Si todos los pasos anteriores fueron exitosos, actualizamos el estado de la OC a 'APROBADA'.
    // SUGERENCIA: Considera añadir columnas `aprobado_por_id` y `fecha_aprobacion` a la tabla `ordenes_compra` para mejor trazabilidad.
    await client.query(
      `UPDATE ordenes_compra SET status = 'APROBADA' WHERE id = $1`,
      [ocId]
    );
    console.log(`[Auth Service] Estado de la OC ${ocData.numero_oc} actualizado a 'APROBADA'.`);

    // --- FIN DE LA TRANSACCIÓN ---
    await client.query('COMMIT');

    return {
      mensaje: `OC ${ocData.numero_oc} autorizada y distribuida exitosamente.`,
      driveLink: driveFile.webViewLink,
    };

  } catch (error) {
    // Si cualquier paso falla, se revierte la actualización de la base de datos.
    await client.query('ROLLBACK');
    console.error(`[Auth Service] Error en el proceso de autorización para OC ${ocId}:`, error);
    // Se relanza el error para que el controlador lo maneje.
    throw error;
  } finally {
    // Siempre se libera la conexión al finalizar.
    client.release();
  }
};

module.exports = {
  authorizeAndDistributeOC,
};