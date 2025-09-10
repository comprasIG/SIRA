// C:/SIRA/backend/controllers/requisiciones.controller.js

const pool = require('../db/pool');
const { uploadRequisitionFiles, uploadPdfBuffer } = require('../services/googleDrive');
const { sendRequisitionEmail } = require('../services/emailService');
const { generateRequisitionPdf } = require('../services/requisitionPdfService');

// --- SECCIÓN DE FUNCIONES HELPER (INTERNAS) ---
const _getRequisicionCompleta = async (id, client) => {
    const db = client || pool;
    // CAMBIO: Se añade "r.lugar_entrega" a la consulta para obtener también el ID.
    const reqQuery = `
      SELECT 
        r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, r.status, 
        r.lugar_entrega, -- <--- ID del lugar de entrega
        r.comentario AS comentario_general, 
        u.nombre AS usuario_creador, u.correo AS usuario_creador_correo, 
        p.id AS proyecto_id, p.nombre AS proyecto, -- Se añade el ID del proyecto
        s.id AS sitio_id, s.nombre AS sitio, -- Se añade el ID del sitio
        d.codigo AS departamento_codigo, d.nombre AS departamento_nombre,
        le.nombre AS lugar_entrega_nombre
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      JOIN departamentos d ON u.departamento_id = d.id
      LEFT JOIN sitios le ON r.lugar_entrega::integer = le.id
      WHERE r.id = $1;
    `;
    const reqResult = await db.query(reqQuery, [id]);
    if (reqResult.rows.length === 0) {
        throw new Error('Requisición no encontrada para generar datos.');
    }
    
    const materialesResult = await db.query(`SELECT rd.id as req_detalle_id, rd.cantidad, rd.comentario, cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad FROM requisiciones_detalle rd JOIN catalogo_materiales cm ON rd.material_id = cm.id JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;`, [id]);
    const adjuntosResult = await db.query(`SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1;`, [id]);
    
    return { ...reqResult.rows[0], materiales: materialesResult.rows, adjuntos: adjuntosResult.rows };
};



// --- SECCIÓN DE CONTROLADORES EXPORTADOS ---

const crearRequisicion = async (req, res) => {
    const archivos = req.files;
    let { usuario_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, materiales } = req.body;
    usuario_id = Number(usuario_id);
    proyecto_id = Number(proyecto_id);
    sitio_id = Number(sitio_id);
    if (typeof materiales === "string") { try { materiales = JSON.parse(materiales); } catch { materiales = []; } }
    if (!usuario_id || !proyecto_id || !sitio_id || !fecha_requerida || !materiales || materiales.length === 0) {
        return res.status(400).json({ error: "Faltan datos obligatorios para la requisición." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userQuery = `SELECT u.id, u.departamento_id, d.codigo AS depto_codigo FROM usuarios u JOIN departamentos d ON u.departamento_id = d.id WHERE u.id = $1 AND u.activo = true`;
        const userResult = await client.query(userQuery, [usuario_id]);
        if (userResult.rowCount === 0) { throw new Error("Usuario no autorizado o inactivo."); }
        const { departamento_id, depto_codigo } = userResult.rows[0];
        const reqInsert = await client.query(`INSERT INTO requisiciones (usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ABIERTA') RETURNING id, numero_requisicion`, [usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario]);
        const { id: requisicion_id, numero_requisicion } = reqInsert.rows[0];
        for (const mat of materiales) {
            await client.query(`INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`, [requisicion_id, mat.material_id, mat.cantidad, mat.comentario || null]);
        }
        if (archivos && archivos.length > 0) {
            const archivosSubidos = await uploadRequisitionFiles(archivos, depto_codigo, numero_requisicion);
            for (const archivo of archivosSubidos) {
                await client.query(`INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`, [requisicion_id, archivo.name, archivo.webViewLink]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ requisicion_id, numero_requisicion });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al crear requisición:", error);
        res.status(500).json({ error: error.message || "Error interno del servidor." });
    } finally {
        client.release();
    }
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

const getRequisicionDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const requisicionCompleta = await _getRequisicionCompleta(id, pool);
        res.json(requisicionCompleta);
    } catch (error) {
        console.error(`Error al obtener detalle de requisición ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const actualizarRequisicion = async (req, res) => {
    const { id: requisicionId } = req.params;
    const archivosNuevos = req.files;
    let { materiales, adjuntosExistentes, ...otrosCampos } = req.body;
    if (typeof materiales === "string") { try { materiales = JSON.parse(materiales); } catch { materiales = []; } }
    if (typeof adjuntosExistentes === "string") { try { adjuntosExistentes = JSON.parse(adjuntosExistentes); } catch { adjuntosExistentes = []; } }
    if (!materiales || materiales.length === 0) { return res.status(400).json({ error: "La requisición debe tener al menos un material." }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE requisiciones SET proyecto_id = $1, sitio_id = $2, fecha_requerida = $3, lugar_entrega = $4, comentario = $5 WHERE id = $6`, [otrosCampos.proyecto_id, otrosCampos.sitio_id, otrosCampos.fecha_requerida, otrosCampos.lugar_entrega, otrosCampos.comentario, requisicionId]);
        await client.query('DELETE FROM requisiciones_detalle WHERE requisicion_id = $1', [requisicionId]);
        for (const mat of materiales) { await client.query(`INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`, [requisicionId, mat.material_id, mat.cantidad, mat.comentario || null]); }
        const placeholders = adjuntosExistentes.map((_, i) => `$${i + 2}`).join(',');
        if (adjuntosExistentes.length > 0) { await client.query(`DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1 AND id NOT IN (${placeholders})`, [requisicionId, ...adjuntosExistentes]); } 
        else { await client.query('DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1', [requisicionId]); }
        if (archivosNuevos && archivosNuevos.length > 0) {
            const reqData = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1`, [requisicionId]);
            const { numero_requisicion, depto_codigo } = reqData.rows[0];
            const archivosSubidos = await uploadRequisitionFiles(archivosNuevos, depto_codigo, numero_requisicion);
            for (const archivo of archivosSubidos) { await client.query(`INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`, [requisicionId, archivo.name, archivo.webViewLink]); }
        }
        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Requisición actualizada correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al actualizar requisición ${requisicionId}:`, error);
        res.status(500).json({ error: error.message || "Error interno del servidor." });
    } finally {
        client.release();
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

const aprobarYNotificar = async (req, res) => {
    const { id } = req.params;
    const { approverName } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // PASO 1: Validar y actualizar la BD
        const reqDataQuery = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'ABIERTA' FOR UPDATE`, [id]);
        if (reqDataQuery.rows.length === 0) {
            throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
        }
        const { numero_requisicion, depto_codigo } = reqDataQuery.rows[0];
        
        const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
        const consecutivo = String(consecutivoResult.rows[0].consecutivo).padStart(4, '0');
        const numReq = numero_requisicion.split('_')[1] || '';
        const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;
        await client.query(`UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2`, [rfq_code, id]);

        // PASO 2: Obtener los datos completos y generar PDF
        const data = await _getRequisicionCompleta(id, client);
        const pdfBuffer = await generateRequisitionPdf(data, approverName);
        const fileName = `Requisicion_${data.numero_requisicion}.pdf`;

        // PASO 3: Subir a Google Drive
        const driveFile = await uploadPdfBuffer(pdfBuffer, fileName, depto_codigo, numero_requisicion);

        // PASO 4: Enviar Correo
        const recipients = ['compras.biogas@gmail.com'];
        if (data.usuario_creador_correo && !recipients.includes(data.usuario_creador_correo)) {
            recipients.push(data.usuario_creador_correo);
        }
        
        if (recipients.length > 0) {
            const subject = `Requisición Aprobada: ${data.numero_requisicion}`;
            let attachmentsHtml = '';
            if (data.adjuntos && data.adjuntos.length > 0) {
                const attachmentLinks = data.adjuntos.map(file => `<li><a href="${file.ruta_archivo}">${file.nombre_archivo}</a></li>`).join('');
                attachmentsHtml = `<p><strong>Archivos Adjuntos:</strong></p><ul>${attachmentLinks}</ul>`;
            }
            const driveLinkHtml = driveFile ? `<p>El PDF de la requisición y sus adjuntos pueden ser consultados en: <a href="${driveFile.webViewLink}">Ver en Google Drive</a>.</p>` : '';
            const body = `<p>Buen día,</p><p>La requisición <strong>${data.numero_requisicion}</strong> ha sido aprobada por <strong>${approverName}</strong> y se adjunta en este correo.</p><ul><li><strong>Solicitante:</strong> ${data.usuario_creador} (${data.usuario_creador_correo})</li><li><strong>Destino:</strong> ${data.sitio} - ${data.proyecto}</li><li><strong>Fecha Requerida:</strong> ${new Date(data.fecha_requerida).toLocaleDateString('es-MX')}</li></ul>${driveLinkHtml}${attachmentsHtml}<hr><p style="font-size: 0.8em; color: #666;">- Notificación automática de SIRA PROJECT -</p>`;
            
            // La llamada al servicio de correo
            await sendRequisitionEmail(recipients, subject, body, pdfBuffer, fileName);
        }
        
        // PASO FINAL: Confirmar transacción y enviar respuesta
        await client.query('COMMIT');

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length
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

// --- SECCIÓN DE EXPORTACIONES ---
module.exports = {
  crearRequisicion,
  getRequisicionesPorAprobar,
  getRequisicionDetalle,
  actualizarRequisicion,
  rechazarRequisicion,
  aprobarYNotificar,
};