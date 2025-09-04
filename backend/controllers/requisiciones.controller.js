// C:/SIRA/backend/controllers/requisiciones.controller.js

const pool = require('../db/pool');
const { uploadRequisitionFiles } = require('../services/googleDrive');
const { sendRequisitionEmail } = require('../services/emailService');
const path = require('path'); // Módulo para manejar rutas de archivos
const PDFDocument = require('pdfkit');

// --- SECCIÓN DE FUNCIONES HELPER (INTERNAS) ---

/**
 * @private
 * Obtiene todos los datos de una requisición para ser usados en el PDF y correo.
 * Reutiliza la lógica de getRequisicionDetalle para evitar duplicar código.
 * @param {number} id - El ID de la requisición.
 * @param {object} client - Una instancia activa del cliente de la base de datos (para transacciones).
 * @returns {Promise<object>} Objeto con todos los datos de la requisición.
 */
const _getRequisicionCompleta = async (id, client) => {
    const db = client || pool; // Usa el cliente de la transacción si se proporciona

    // 1. Obtener datos de la cabecera (incluyendo el correo del creador)
    const reqQuery = `
      SELECT r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, 
             u.nombre AS usuario_creador, u.correo AS usuario_creador_correo, 
             p.nombre AS proyecto, s.nombre AS sitio
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.id = $1;
    `;
    const reqResult = await db.query(reqQuery, [id]);
    if (reqResult.rows.length === 0) {
        throw new Error('Requisición no encontrada para generar datos.');
    }

    // 2. Obtener materiales
    const materialesQuery = `
      SELECT rd.cantidad, rd.comentario, cm.nombre AS material, cu.simbolo AS unidad
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON rd.material_id = cm.id
      JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
      WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
    `;
    const materialesResult = await db.query(materialesQuery, [id]);

    // 3. Obtener adjuntos
    const adjuntosQuery = `SELECT nombre_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1;`;
    const adjuntosResult = await db.query(adjuntosQuery, [id]);

    // 4. Ensamblar la respuesta
    return {
        ...reqResult.rows[0],
        materiales: materialesResult.rows,
        adjuntos: adjuntosResult.rows
    };
};


// --- SECCIÓN DE CONTROLADORES EXPORTADOS ---

/**
 * Crea una nueva requisición y sus detalles.
 * Maneja tanto JSON como FormData (para archivos).
 */
const crearRequisicion = async (req, res) => {
  const archivos = req.files;
  let { usuario_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, materiales } = req.body;
  
  // Conversión y validación de datos
  usuario_id = Number(usuario_id);
  proyecto_id = Number(proyecto_id);
  sitio_id = Number(sitio_id);
  if (typeof materiales === "string") {
    try { materiales = JSON.parse(materiales); } catch { materiales = []; }
  }
  if (!usuario_id || !proyecto_id || !sitio_id || !fecha_requerida || !materiales || materiales.length === 0) {
    return res.status(400).json({ error: "Faltan datos obligatorios para la requisición." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userQuery = `
      SELECT u.id, u.departamento_id, d.codigo AS depto_codigo 
      FROM usuarios u
      JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.id = $1 AND u.activo = true
    `;
    const userResult = await client.query(userQuery, [usuario_id]);
    if (userResult.rowCount === 0) {
      throw new Error("Usuario no autorizado o inactivo.");
    }
    
    const { departamento_id, depto_codigo } = userResult.rows[0];

    // 1. Primero, ejecuta la consulta y guarda el resultado en reqInsert
    const reqInsert = await client.query(
      `INSERT INTO requisiciones (usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ABIERTA') RETURNING id, numero_requisicion`,
      [usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario]
    );

    // 2. Ahora que reqInsert existe, ya puedes leer sus valores
    const requisicion_id = reqInsert.rows[0].id;
    const numero_requisicion = reqInsert.rows[0].numero_requisicion;

    // Inserta el detalle de materiales
    for (const mat of materiales) {
      await client.query(`INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`, [requisicion_id, mat.material_id, mat.cantidad, mat.comentario || null]);
    }

    // Lógica para subir archivos
     if (archivos && archivos.length > 0) {
      const archivosSubidos = await uploadRequisitionFiles(archivos, depto_codigo, numero_requisicion);
      for (const archivo of archivosSubidos) {
        await client.query(
          `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`,
          [requisicion_id, archivo.name, archivo.webViewLink]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ requisicion_id, numero_requisicion: numero_requisicion });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al crear requisición:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor." });
  } finally {
    client.release();
  }
};

/**
 * Obtiene las requisiciones pendientes de aprobación para el departamento del usuario.
 */
const getRequisicionesPorAprobar = async (req, res) => {
  const departamentoId = req.usuarioSira?.departamento_id;
  if (!departamentoId) {
    return res.status(403).json({ error: "No se pudo determinar el departamento del usuario." });
  }
  try {
    const query = `
      SELECT r.id, r.numero_requisicion, r.fecha_creacion, r.fecha_requerida, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio, r.comentario, r.status
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.departamento_id = $1 AND r.status = 'ABIERTA' ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query, [departamentoId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones por aprobar:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Obtiene el detalle completo de una requisición, incluyendo materiales y adjuntos.
 */
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

/**
 * Actualiza una requisición existente.
 */
const actualizarRequisicion = async (req, res) => {
    const { id: requisicionId } = req.params;
    const archivosNuevos = req.files;
    let { materiales, adjuntosExistentes, ...otrosCampos } = req.body;

    if (typeof materiales === "string") {
        try { materiales = JSON.parse(materiales); } catch { materiales = []; }
    }
    if (typeof adjuntosExistentes === "string") {
        try { adjuntosExistentes = JSON.parse(adjuntosExistentes); } catch { adjuntosExistentes = []; }
    }
    
    if (!materiales || materiales.length === 0) {
        return res.status(400).json({ error: "La requisición debe tener al menos un material." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Actualizar la cabecera
        await client.query(
            `UPDATE requisiciones 
             SET proyecto_id = $1, sitio_id = $2, fecha_requerida = $3, lugar_entrega = $4, comentario = $5
             WHERE id = $6`,
            [otrosCampos.proyecto_id, otrosCampos.sitio_id, otrosCampos.fecha_requerida, otrosCampos.lugar_entrega, otrosCampos.comentario, requisicionId]
        );

        // 2. Reemplazar los materiales
        await client.query('DELETE FROM requisiciones_detalle WHERE requisicion_id = $1', [requisicionId]);
        for (const mat of materiales) {
            await client.query(
                `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario) VALUES ($1, $2, $3, $4)`,
                [requisicionId, mat.material_id, mat.cantidad, mat.comentario || null]
            );
        }

        // 3. Borrar los adjuntos que el usuario eliminó
        const placeholders = adjuntosExistentes.map((_, i) => `$${i + 2}`).join(',');
        if (adjuntosExistentes.length > 0) {
          await client.query(
            `DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1 AND id NOT IN (${placeholders})`,
            [requisicionId, ...adjuntosExistentes]
          );
        } else {
          await client.query('DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1', [requisicionId]);
        }

        // 4. Subir y registrar los nuevos archivos adjuntos si existen
        if (archivosNuevos && archivosNuevos.length > 0) {
            const reqData = await client.query(
                `SELECT r.numero_requisicion, d.codigo as depto_codigo 
                 FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id 
                 WHERE r.id = $1`, [requisicionId]);
            const { numero_requisicion, depto_codigo } = reqData.rows[0];
            const archivosSubidos = await uploadRequisitionFiles(archivosNuevos, depto_codigo, numero_requisicion);

            for (const archivo of archivosSubidos) {
                await client.query(
                    `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo) VALUES ($1, $2, $3)`,
                    [requisicionId, archivo.name, archivo.webViewLink]
                );
            }
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

/**
 * Rechaza una requisición, cambiando su estado a 'CANCELADA'.
 */
const rechazarRequisicion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1 AND status = 'ABIERTA' RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'La requisición no existe o ya fue procesada.' });
    }
    res.status(200).json({ mensaje: `Requisición ${id} ha sido cancelada.` });
  } catch (error) {
    console.error(`Error al rechazar requisición ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * Aprueba una requisición, genera PDF, lo envía por correo y lo devuelve para descarga.
 */
const aprobarYNotificar = async (req, res) => {
    const { id } = req.params;
    const { approverName } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- PASO 1: Aprobar la requisición en la BD ---
        const reqData = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'ABIERTA'`, [id]);
        if (reqData.rows.length === 0) {
            throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
        }
        const { numero_requisicion, depto_codigo } = reqData.rows[0];
        const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
        const consecutivo = consecutivoResult.rows[0].consecutivo;
        const numReq = numero_requisicion.split('_')[1] || '';
        const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;
        await client.query(`UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2`, [rfq_code, id]);

        // --- PASO 2: Obtener todos los datos necesarios ---
        const data = await _getRequisicionCompleta(id, client);

        // --- PASO 3: Generar el PDF en memoria con el nuevo diseño ---
        const pdfBuffer = await new Promise(resolve => {
            const doc = new PDFDocument({ margin: 40, size: 'letter' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // --- ENCABEZADO DEL PDF ---
            const logoPath = path.join(__dirname, '..', 'assets', 'logo.png'); // Ruta al logo en el backend
            doc.image(logoPath, 40, 40, { width: 60 });
            doc.fontSize(10).font('Helvetica-Bold').text('GRUPO IG', 40, 105);

            doc.fontSize(16).font('Helvetica-Bold').text('REQUISICIÓN DE MATERIALES', 0, 60, { align: 'center' });
            
            doc.fontSize(10).font('Helvetica').text(`Número Req: ${data.numero_requisicion}`, 400, 50, { align: 'right' });
            doc.text(`Fecha de Aprobación: ${new Date().toLocaleDateString()}`, 400, 65, { align: 'right' });

            doc.moveTo(40, 125).lineTo(572, 125).stroke(); // Línea divisoria

            // --- SECCIÓN DE INFORMACIÓN GENERAL ---
            let startY = 140;
            doc.fontSize(12).font('Helvetica-Bold').text('Información General', 40, startY);
            startY += 20;

            const col1X = 50;
            const col2X = 320;
            doc.fontSize(10);
            doc.font('Helvetica-Bold').text('Solicitante:', col1X, startY);
            doc.font('Helvetica').text(data.usuario_creador, col1X + 80, startY);
            doc.font('Helvetica-Bold').text('Aprobado por:', col2X, startY);
            doc.font('Helvetica').text(approverName, col2X + 80, startY);
            startY += 15;

            const depto = data.numero_requisicion.split('_')[0];
            doc.font('Helvetica-Bold').text('Departamento:', col1X, startY);
            doc.font('Helvetica').text(depto, col1X + 80, startY);
            doc.font('Helvetica-Bold').text('Fecha Req:', col2X, startY);
            doc.font('Helvetica').text(new Date(data.fecha_requerida).toLocaleDateString(), col2X + 80, startY);
            startY += 15;

            doc.font('Helvetica-Bold').text('Proyecto:', col1X, startY);
            doc.font('Helvetica').text(data.proyecto, col1X + 80, startY);
            doc.font('Helvetica-Bold').text('Lugar Entrega:', col2X, startY);
            doc.font('Helvetica').text(data.lugar_entrega, col2X + 80, startY);
            startY += 25;

            // --- TABLA DE MATERIALES ---
            const tableTop = startY;
            const itemX = 45;
            const qtyX = 300;
            const unitX = 380;
            const commentX = 450;

            doc.font('Helvetica-Bold');
            doc.text('Material', itemX, tableTop);
            doc.text('Cantidad', qtyX, tableTop, {width: 60, align: 'center'});
            doc.text('Unidad', unitX, tableTop, {width: 60, align: 'center'});
            doc.text('Comentario', commentX, tableTop);
            doc.moveTo(40, tableTop + 15).lineTo(572, tableTop + 15).stroke();
            let tableY = tableTop + 20;
            
            doc.font('Helvetica');
            data.materiales.forEach(item => {
                doc.text(item.material, itemX, tableY, { width: 250 });
                doc.text(parseFloat(item.cantidad).toFixed(2), qtyX, tableY, { width: 60, align: 'center' });
                doc.text(item.unidad, unitX, tableY, { width: 60, align: 'center' });
                doc.text(item.comentario || 'N/A', commentX, tableY, { width: 120 });
                tableY += 30; // Espacio dinámico sería mejor, pero esto es un inicio
                doc.moveTo(40, tableY - 10).lineTo(572, tableY - 10).strokeOpacity(0.2).stroke();
            });
            let finalY = tableY;

            // --- SECCIONES FINALES (COMENTARIOS Y ADJUNTOS) ---
            if (data.comentario_general) {
                finalY += 10;
                doc.font('Helvetica-Bold').text('Comentario General:', 40, finalY);
                doc.font('Helvetica').text(data.comentario_general, 45, finalY + 15, { width: 527 });
                finalY = doc.y + 10;
            }

            if (data.adjuntos && data.adjuntos.length > 0) {
                finalY += 10;
                doc.font('Helvetica-Bold').text('Archivos Adjuntos:', 40, finalY);
                doc.font('Helvetica');
                data.adjuntos.forEach(adjunto => {
                    doc.text(`- ${adjunto.nombre_archivo}`, 45, finalY + 15);
                    finalY += 15;
                });
            }

            // --- PIE DE PÁGINA ---
            const pageHeight = doc.page.height;
            doc.fontSize(8).font('Helvetica-Oblique');
            doc.text('Este documento contiene información confidencial y es propiedad de Grupo IG.', 40, pageHeight - 80, { width: 532, align: 'center' });
            doc.text('Su uso y distribución están restringidos. Para dudas o seguimiento, contacte al equipo de Compras.', 40, pageHeight - 70, { width: 532, align: 'center' });
            doc.text('Documento generado automáticamente por el Sistema Integral de Requisiciones y Abastecimiento de Grupo IG - SIRA PROJECT', 40, pageHeight - 60, { width: 532, align: 'center' });
            doc.text(`Página 1`, 40, pageHeight - 40, { align: 'right' });

            doc.end();
        });

        // --- PASO 4: Preparar y Enviar el Correo con Enlaces a Adjuntos ---
        const recipientIds = [3, 8];
        const userQuery = await client.query('SELECT correo FROM usuarios WHERE id = ANY($1::int[])', [recipientIds]);
        const recipients = userQuery.rows.map(user => user.correo);

        if (recipients.length > 0) {
            const subject = `Requisición Aprobada: ${data.numero_requisicion}`;
            const fileName = `Requisicion_${data.numero_requisicion}.pdf`;
            
            let adjuntosHtml = '';
            if (data.adjuntos && data.adjuntos.length > 0) {
                adjuntosHtml += '<p><strong>Archivos adjuntos de referencia (haga clic para ver):</strong></p><ul>';
                data.adjuntos.forEach(adjunto => {
                    adjuntosHtml += `<li><a href="${adjunto.ruta_archivo}">${adjunto.nombre_archivo}</a></li>`;
                });
                adjuntosHtml += '</ul>';
            }

            const body = `
                <p>Buen día,</p>
                <p><strong>${data.usuario_creador}</strong> ha creado la requisición <strong>${data.numero_requisicion}</strong>, anexa en este correo.</p>
                <ul>
                    <li><strong>Destino del material:</strong> ${data.sitio} - ${data.proyecto}</li>
                    <li><strong>Fecha solicitada de llegada:</strong> ${new Date(data.fecha_requerida).toLocaleDateString()}</li>
                </ul>
                <p>Para cualquier duda con este requerimiento favor de contactar a <strong>${data.usuario_creador_correo}</strong>.</p>
                ${adjuntosHtml}
                <hr>
                <p style="font-size: 0.8em; color: #666;">
                    -Esta es una notificación automática de SIRA -sistema integral de requisiciones y abastecimiento de GRUPO-IG<br>
                    -La información contenida en este correo es confidencial
                </p>
            `;
            sendRequisitionEmail(recipients, subject, body, pdfBuffer, fileName);
        }

        // --- PASO 5: Devolver el PDF al frontend ---
        await client.query('COMMIT');
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        res.end(pdfBuffer);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error en aprobar y notificar requisición ${id}:`, error);
        res.status(500).json({ error: error.message || "Error interno del servidor." });
    } finally {
        client.release();
    }
};

/**
 * Aprueba una requisición (FUNCIÓN ANTIGUA - Se mantiene por si se necesita, pero la nueva es aprobarYNotificar).
 */
const aprobarRequisicion = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqData = await client.query(`SELECT r.numero_requisicion, d.codigo as depto_codigo FROM requisiciones r JOIN departamentos d ON r.departamento_id = d.id WHERE r.id = $1 AND r.status = 'ABIERTA'`, [id]);
    if (reqData.rows.length === 0) {
      throw new Error('La requisición no existe o ya no está en estado ABIERTA.');
    }
    const { numero_requisicion, depto_codigo } = reqData.rows[0];
    const consecutivoResult = await client.query("SELECT nextval('rfq_consecutivo_seq') as consecutivo");
    const consecutivo = consecutivoResult.rows[0].consecutivo;
    const numReq = numero_requisicion.split('_')[1] || '';
    const rfq_code = `${consecutivo}_R.${numReq}_${depto_codigo}`;
    const updateResult = await client.query(`UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2 RETURNING *`, [rfq_code, id]);
    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Requisición aprobada y enviada a compras.', rfq_code: rfq_code, requisicion: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al aprobar requisición ${id}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
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
  aprobarRequisicion,     // Función original
  aprobarYNotificar,      // Nueva función con envío de correo
};