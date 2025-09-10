//C:\SIRA\backend\controllers\requisiciones\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Visto Bueno de Requisiciones (Versión Corregida)
 * =================================================================================================
 */
const pool = require('../../db/pool');
const { uploadPdfBuffer } = require('../../services/googleDrive');
const { sendRequisitionEmail } = require('../../services/emailService');
const { generateRequisitionPdf } = require('../../services/requisitionPdfService');
const { _getRequisicionCompleta } = require('./helper');

const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
    const query = `
        SELECT u.correo FROM usuarios u
        JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
        JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
        WHERE ng.codigo = $1 AND u.activo = true;
    `;
    const result = await client.query(query, [codigoGrupo]);
    return result.rows.map(row => row.correo);
};

const getRequisicionesPorAprobar = async (req, res) => {
    const departamentoId = req.usuarioSira?.departamento_id;
    if (!departamentoId) {
        return res.status(403).json({ error: "No se pudo determinar el departamento del usuario." });
    }
    try {
        const query = `SELECT r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio, r.comentario, r.status FROM requisiciones r JOIN usuarios u ON r.usuario_id = u.id JOIN proyectos p ON r.proyecto_id = p.id JOIN sitios s ON r.sitio_id = s.id WHERE r.departamento_id = $1 AND r.status = 'ABIERTA' ORDER BY r.fecha_creacion ASC;`;
        const result = await pool.query(query, [departamentoId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener requisiciones por aprobar:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const rechazarRequisicion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1 AND status = 'ABIERTA' RETURNING id`, [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: 'La requisición no existe o ya fue procesada.' }); }
        res.status(200).json({ mensaje: `Requisición ${id} ha sido cancelada.` });
    } catch (error) {
        console.error(`Error al rechazar requisición ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * @description Aprueba una requisición y notifica al grupo correspondiente.
 */
const aprobarYNotificar = async (req, res) => {
    const { id } = req.params;
    const { approverName } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const reqDataQuery = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'ABIERTA' FOR UPDATE`, [id]);
        if (reqDataQuery.rows.length === 0) throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
        const { numero_requisicion, depto_codigo } = reqDataQuery.rows[0];
        
        const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
        const consecutivo = String(consecutivoResult.rows[0].consecutivo).padStart(4, '0');
        const numReq = numero_requisicion.split('_')[1] || '';
        const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;
        await client.query(`UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2`, [rfq_code, id]);

        const data = await _getRequisicionCompleta(id, client);
        const pdfBuffer = await generateRequisitionPdf(data, approverName);
        const fileName = `Requisicion_${data.numero_requisicion}.pdf`;

        // --- ¡CORRECCIÓN! Se pasan los argumentos correctos ---
        const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, 'REQUISICIONES', data.numero_requisicion);

        const recipients = await _getRecipientEmailsByGroup('REQ_APROBADA_NOTIFICAR_COMPRAS', client);
        if (data.usuario_creador_correo && !recipients.includes(data.usuario_creador_correo)) {
            recipients.push(data.usuario_creador_correo);
        }
        
        if (recipients.length > 0) {
            // --- ¡CORRECCIÓN! Se definen las variables 'subject' y 'body' ---
            const subject = `Requisición Aprobada: ${data.numero_requisicion}`;
            const driveLinkHtml = driveFile ? `<p>El PDF puede ser consultado en: <a href="${driveFile.webViewLink}">Ver en Google Drive</a>.</p>` : '';
            const body = `<p>La requisición <strong>${data.numero_requisicion}</strong> ha sido aprobada por <strong>${approverName}</strong> y se adjunta en este correo.</p><ul><li>Solicitante: ${data.usuario_creador}</li><li>Destino: ${data.sitio} - ${data.proyecto}</li></ul>${driveLinkHtml}`;
            
            await sendRequisitionEmail(recipients, subject, body, pdfBuffer, fileName);
        } else {
            console.warn(`No se encontraron destinatarios en el grupo para la Req ${id}.`);
        }
        
        await client.query('COMMIT');
        
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        res.end(pdfBuffer);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error en la transacción de aprobación para Req ${id}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || "Error interno al procesar la aprobación." });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getRequisicionesPorAprobar,
    rechazarRequisicion,
    aprobarYNotificar,
};