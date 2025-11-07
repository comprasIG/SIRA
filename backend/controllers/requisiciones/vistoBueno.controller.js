//C:\SIRA\backend\controllers\requisiciones\vistoBueno.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Visto Bueno de Requisiciones (Versión Corregida v4)
 * =================================================================================================
 * --- HISTORIAL DE CAMBIOS ---
 * v4: Se actualiza el 'require' de Google Drive.
 * - Se reemplaza 'uploadRequisitionPdf' (obsoleto) por 'uploadPdfBuffer'.
 * - Se ajustan los argumentos de la llamada a 'uploadPdfBuffer'.
 */
const pool = require('../../db/pool');
// ==================================================================
// --- INICIO DE LA CORRECCIÓN ---
// Se importa 'uploadPdfBuffer' en lugar de 'uploadRequisitionPdf'
// ==================================================================
const { uploadPdfBuffer } = require('../../services/googleDrive');
// ==================================================================
// --- FIN DE LA CORRECCIÓN ---
// ==================================================================
const { sendRequisitionEmail } = require('../../services/emailService');
const { generateRequisitionPdf } = require('../../services/requisitionPdfService');
const { _getRequisicionCompleta } = require('./helper');

const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
    // ... (función sin cambios)
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
    // ... (función sin cambios)
    const departamentoId = req.usuarioSira?.departamento_id;
    if (!departamentoId) {
        return res.status(403).json({ error: 'Usuario no asignado a un departamento.' });
    }
    try {
        const query = `
            SELECT r.id, r.numero_requisicion, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            WHERE r.departamento_id = $1 AND r.status = 'ABIERTA'
            ORDER BY r.fecha_creacion ASC;
        `;
        const result = await pool.query(query, [departamentoId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener requisiciones por aprobar:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const aprobarYNotificar = async (req, res) => {
    const { id } = req.params; // ID de la requisición
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Actualizar estado y obtener datos
        const updateQuery = `
            UPDATE requisiciones r
            SET status = 'COTIZANDO'
            FROM departamentos d
            WHERE r.id = $1 AND r.status = 'ABIERTA' AND r.departamento_id = d.id
            RETURNING r.id, r.numero_requisicion, d.codigo as depto_codigo;
        `;
        const updateResult = await client.query(updateQuery, [id]);
        if (updateResult.rowCount === 0) {
            throw new Error('La requisición no se encontró o ya fue aprobada/procesada.');
        }
        const rfqData = updateResult.rows[0];
        const fileName = `${rfqData.numero_requisicion}.pdf`;

        // 2. Generar PDF (usando el helper)
        const reqCompleta = await _getRequisicionCompleta(id, client);
        if (!reqCompleta) throw new Error('No se pudieron obtener los datos completos para generar el PDF.');
        
        const pdfBuffer = await generateRequisitionPdf(reqCompleta);

        // ==================================================================
        // --- INICIO DE LA CORRECCIÓN (Llamada a Drive) ---
        // ==================================================================
        
        // 3. Subir PDF a Google Drive usando la nueva función
        const driveFile = await uploadPdfBuffer(
            pdfBuffer,
            fileName,
            'REQUISICIONES_PDF', // folderType (Carpeta específica para PDFs de Req)
            rfqData.numero_requisicion // reqNum (Para encontrar la carpeta padre)
        );
        
        if (!driveFile || !driveFile.webViewLink) {
            throw new Error('Falló la subida del PDF de Requisición a Google Drive.');
        }

        // 4. Actualizar requisición con el link de Drive
        await client.query(
            `UPDATE requisiciones SET drive_url_pdf = $1 WHERE id = $2`,
            [driveFile.webViewLink, id]
        );
        
        // ==================================================================
        // --- FIN DE LA CORRECCIÓN ---
        // ==================================================================

        // 5. Enviar notificación por correo
        const recipients = await _getRecipientEmailsByGroup('REQ_APROBADA_NOTIFICAR', client);
        if (recipients.length > 0) {
            const subject = `Requisición Aprobada para Cotizar: ${rfqData.numero_requisicion}`;
            const htmlBody = `
                <p>La requisición <strong>${rfqData.numero_requisicion}</strong> ha sido aprobada y está lista para cotizar.</p>
                <p>Se adjunta el PDF de la requisición.</p>
                <p>Link a Drive: <a href="${driveFile.webViewLink}">Ver PDF en Drive</a></p>
            `;
            await sendRequisitionEmail(recipients, subject, htmlBody, pdfBuffer, fileName);
        } else {
            console.warn(`No se encontraron destinatarios en el grupo para la Req ${id}.`);
        }
        
        await client.query('COMMIT');
        
        // 3. Enviar a Frontend (Descarga)
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
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

const rechazarRequisicion = async (req, res) => {
    // ... (sin cambios)
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'ABIERTA' WHERE id = $1 AND status = 'POR_APROBAR' RETURNING id`, [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'La requisición no se encontró o no está en estado "POR APROBAR".' });
        }
        res.status(200).json({ mensaje: 'La requisición ha sido devuelta al solicitante.' });
    } catch (error) {
        console.error(`Error al rechazar requisición ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = {
    getRequisicionesPorAprobar,
    aprobarYNotificar,
    rechazarRequisicion
};