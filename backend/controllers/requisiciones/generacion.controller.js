//C:\SIRA\backend\controllers\requisiciones\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación de Requisiciones
 * =================================================================================================
 */
const pool = require('../../db/pool');
const { uploadRequisitionFiles } = require('../../services/googleDrive');
const { _getRequisicionCompleta } = require('./helper');

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
    } // ... (Mueve aquí la función 'crearRequisicion' completa desde el archivo .old.js)
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

module.exports = {
    crearRequisicion,
    getRequisicionDetalle,
    actualizarRequisicion,
};