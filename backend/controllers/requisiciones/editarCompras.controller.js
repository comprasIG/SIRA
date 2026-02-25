// C:\SIRA\backend\controllers\requisiciones\editarCompras.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Edición restringida y regeneración de PDF (solo Compras/SSD)
 * =================================================================================================
 * - obtenerProteccionOC:       devuelve qué materiales están bloqueados por OC activa
 * - editarRequisicionCompras:  permite quitar/modificar partidas SIN OC activa, cambiar sitio/proyecto
 * - regenerarPdfRequisicion:   regenera el PDF con datos actuales y lo sube a Drive
 */
const pool = require('../../db/pool');
const { uploadRequisitionPdf } = require('../../services/googleDrive');
const { generateRequisitionPdf } = require('../../services/requisitionPdfService');
const { _getRequisicionCompleta } = require('./helper');

/**
 * Consulta qué material_ids de una requisición tienen OC activa (no CANCELADA).
 * Devuelve un Set de material_id protegidos.
 */
async function _getMaterialesConOCActiva(requisicionId, dbClient) {
    const result = await dbClient.query(
        `SELECT DISTINCT rd.material_id
         FROM requisiciones_detalle rd
         JOIN ordenes_compra_detalle ocd ON ocd.requisicion_detalle_id = rd.id
         JOIN ordenes_compra oc ON oc.id = ocd.orden_compra_id
         WHERE rd.requisicion_id = $1
           AND oc.status <> 'CANCELADA'`,
        [requisicionId]
    );
    return new Set(result.rows.map(r => r.material_id));
}

/**
 * GET /api/requisiciones/:id/proteccion-oc
 * Devuelve los material_ids que están protegidos por tener OC activa.
 */
const obtenerProteccionOC = async (req, res) => {
    const { id } = req.params;
    try {
        const protegidos = await _getMaterialesConOCActiva(id, pool);
        res.json({ material_ids_protegidos: Array.from(protegidos) });
    } catch (error) {
        console.error(`Error al obtener protección OC para requisición ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * PATCH /api/requisiciones/:id/editar-compras
 * Body: { sitio_id, proyecto_id, materiales: [{ material_id, cantidad, comentario }] }
 *
 * Reglas de protección:
 *  - Materiales con OC activa (status <> 'CANCELADA') NO se pueden quitar ni modificar.
 *  - Solo se pueden quitar/modificar materiales sin OC o con OC CANCELADA.
 */
const editarRequisicionCompras = async (req, res) => {
    const { id } = req.params;
    let { sitio_id, proyecto_id, materiales } = req.body;

    // Normalizar
    sitio_id = Number(sitio_id);
    proyecto_id = Number(proyecto_id);
    if (typeof materiales === 'string') {
        try { materiales = JSON.parse(materiales); } catch { materiales = []; }
    }

    // Validaciones
    if (!sitio_id || !proyecto_id) {
        return res.status(400).json({ error: 'Sitio y proyecto son obligatorios.' });
    }
    if (!Array.isArray(materiales) || materiales.length === 0) {
        return res.status(400).json({ error: 'La requisición debe tener al menos una partida.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar que la requisición existe
        const reqCheck = await client.query(
            'SELECT id, status FROM requisiciones WHERE id = $1 FOR UPDATE',
            [id]
        );
        if (reqCheck.rowCount === 0) {
            throw new Error('Requisición no encontrada.');
        }

        // Obtener material_ids originales de la requisición (con su id de detalle)
        const originalMats = await client.query(
            'SELECT id, material_id, cantidad, comentario FROM requisiciones_detalle WHERE requisicion_id = $1',
            [id]
        );
        const originalMatIds = new Set(originalMats.rows.map(r => r.material_id));

        // Obtener materiales protegidos por OC activa
        const protegidos = await _getMaterialesConOCActiva(id, client);

        // Validar que cada material enviado exista en la requisición original
        const materialesEnviados = new Set();
        for (const mat of materiales) {
            const matId = Number(mat.material_id);
            if (!originalMatIds.has(matId)) {
                throw new Error(`El material con ID ${matId} no forma parte de la requisición original. Solo se pueden quitar partidas, no agregar nuevas.`);
            }
            if (!mat.cantidad || Number(mat.cantidad) <= 0) {
                throw new Error(`La cantidad para el material ${matId} debe ser mayor a 0.`);
            }
            materialesEnviados.add(matId);
        }

        // Validar que los materiales protegidos no se hayan quitado
        for (const protegidoId of protegidos) {
            if (!materialesEnviados.has(protegidoId)) {
                throw new Error(`El material ${protegidoId} tiene una OC activa y no puede ser eliminado de la requisición.`);
            }
        }

        // Validar que los materiales protegidos no hayan cambiado su cantidad
        for (const mat of materiales) {
            const matId = Number(mat.material_id);
            if (protegidos.has(matId)) {
                const original = originalMats.rows.find(r => r.material_id === matId);
                if (original && Number(mat.cantidad) !== Number(original.cantidad)) {
                    throw new Error(`El material ${matId} tiene una OC activa y su cantidad no puede ser modificada.`);
                }
            }
        }

        // Actualizar sitio y proyecto
        await client.query(
            'UPDATE requisiciones SET sitio_id = $1, proyecto_id = $2 WHERE id = $3',
            [sitio_id, proyecto_id, id]
        );

        // Solo eliminar materiales que NO están protegidos
        // Primero eliminar los no protegidos que no están en la lista enviada
        for (const original of originalMats.rows) {
            if (!protegidos.has(original.material_id) && !materialesEnviados.has(original.material_id)) {
                await client.query(
                    'DELETE FROM requisiciones_detalle WHERE id = $1',
                    [original.id]
                );
            }
        }

        // Actualizar cantidades de materiales no protegidos que sí están en la lista
        for (const mat of materiales) {
            const matId = Number(mat.material_id);
            if (!protegidos.has(matId)) {
                // Actualizar la partida existente (no recrear, para no romper FKs de ordenes_compra_detalle)
                await client.query(
                    `UPDATE requisiciones_detalle
                     SET cantidad = $1, comentario = $2
                     WHERE requisicion_id = $3 AND material_id = $4`,
                    [mat.cantidad, mat.comentario || null, id, matId]
                );
            }
            // Si está protegido, no se toca
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Requisición actualizada correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al editar requisición ${id} (compras):`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

/**
 * POST /api/requisiciones/:id/regenerar-pdf
 * Regenera el PDF de la requisición con los datos actuales y lo sube a Drive.
 */
const regenerarPdfRequisicion = async (req, res) => {
    const { id } = req.params;
    const approverName = req.body?.approverName || 'Compras';

    try {
        // Obtener datos completos de la requisición
        const data = await _getRequisicionCompleta(id, pool);
        const fileName = `${data.numero_requisicion}.pdf`;

        // Generar PDF
        const pdfBuffer = await generateRequisitionPdf(data, approverName);

        // Subir a Drive
        await uploadRequisitionPdf(
            pdfBuffer,
            fileName,
            data.departamento_codigo,
            data.numero_requisicion
        );

        // Enviar al navegador para descarga
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(pdfBuffer);
    } catch (error) {
        console.error(`Error al regenerar PDF para requisición ${id}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Error interno al regenerar el PDF.' });
        }
    }
};

module.exports = {
    obtenerProteccionOC,
    editarRequisicionCompras,
    regenerarPdfRequisicion,
};
