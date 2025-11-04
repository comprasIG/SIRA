// C:\SIRA\backend\controllers\rfq\vistoBueno.controller.js
/**
 * ================================================================================================
 * CONTROLADOR: Visto Bueno de Cotizaciones (VB_RFQ) - Versión 5.0 (Centralizada)
 * ================================================================================================
 * @file vistoBueno.controller.js
 * @description ¡CAMBIO! Este controlador ya no genera la OC. Ahora delega
 * toda la lógica de creación, PDF, Drive y Email al servicio
 * 'ocAuthorizationService' para eliminar código duplicado.
 */

const pool = require('../../db/pool');
// --- ¡CAMBIO! Se importa el orquestador maestro ---
const { createAndAuthorizeOC } = require('../../services/ocAuthorizationService');

/* ================================================================================================
 * SECCIÓN 1: Helpers
 * (Se elimina _getRecipientEmailsByGroup porque ya no se usa aquí)
 * ==============================================================================================*/

/* ================================================================================================
 * SECCIÓN 2: Endpoints de VB_RFQ
 * ==============================================================================================*/

/**
 * GET /api/rfq/por-aprobar
 */
const getRfqsPorAprobar = async (req, res) => {
    // ... (sin cambios)
    try {
        const query = `
          SELECT r.id, r.rfq_code, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
          FROM requisiciones r
          JOIN usuarios u ON r.usuario_id = u.id
          JOIN proyectos p ON r.proyecto_id = p.id
          JOIN sitios s ON r.sitio_id = s.id
          WHERE r.status = 'POR_APROBAR'
          ORDER BY r.fecha_creacion ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener RFQs por aprobar:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/rfq/:id/rechazar
 */
const rechazarRfq = async (req, res) => {
    // ... (sin cambios)
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE requisiciones SET status = 'COTIZANDO' WHERE id = $1 AND status = 'POR_APROBAR' RETURNING id`, [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El RFQ no se encontró o ya no está en estado para ser rechazado.' });
        }
        res.status(200).json({ mensaje: 'El RFQ ha sido devuelto a cotización.' });
    } catch (error) {
        console.error(`Error al rechazar RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/rfq/:id/generar-ocs
 * ¡Función crítica refactorizada!
 */
const generarOcsDesdeRfq = async (req, res) => {
    const { id: rfqId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const { proveedorId } = req.body;
    
    // ¡CAMBIO! Se elimina la conexión directa a 'client'
    // El servicio orquestador manejará la transacción.
    
    try {
        // --- 1. Validar RFQ y OBTENER DATOS DE RUTA ---
        // (Se hace fuera de la transacción para obtener los datos)
        const rfqQuery = await pool.query(
            `SELECT r.numero_requisicion, r.rfq_code, r.lugar_entrega, r.sitio_id, r.proyecto_id,
                    d.codigo as depto_codigo 
             FROM requisiciones r 
             JOIN departamentos d ON r.departamento_id = d.id 
             WHERE r.id = $1 AND r.status = 'POR_APROBAR'`, [rfqId]
        );
        if (rfqQuery.rowCount === 0) throw new Error('El RFQ no existe, ya fue procesado o no está para aprobación.');
        
        const rfqData = rfqQuery.rows[0];

        // --- 2. Buscar IDs de opciones seleccionadas NO bloqueadas ---
        const opcionesBloqueadasQuery = await pool.query(
            `SELECT comparativa_precio_id FROM ordenes_compra_detalle 
             WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE rfq_id = $1)`, [rfqId]
        );
        const opcionesBloqueadas = opcionesBloqueadasQuery.rows.map(row => Number(row.comparativa_precio_id));

        let opcionesQueryString = `
            SELECT id 
            FROM requisiciones_opciones
            WHERE requisicion_id = $1 AND seleccionado = TRUE
        `;
        const queryParams = [rfqId];
        if (proveedorId) {
            opcionesQueryString += ` AND proveedor_id = $2`;
            queryParams.push(proveedorId);
        }
        if (opcionesBloqueadas.length > 0) {
            opcionesQueryString += ` AND id NOT IN (${opcionesBloqueadas.join(',')})`;
        }
        
        const opcionesQuery = await pool.query(opcionesQueryString, queryParams);
        const opcionIds = opcionesQuery.rows.map(r => r.id);

        if (opcionIds.length === 0) {
            throw new Error('No hay opciones pendientes para generar OC para este proveedor.');
        }

        // --- 3. Llamar al Orquestador Maestro ---
        // (Se elimina toda la lógica duplicada de creación de OC, PDF, Drive y Email)
        const nuevaOc = await createAndAuthorizeOC({
            rfqId,
            usuarioId,
            opcionIds, // Solo pasamos los IDs de las opciones a generar
            rfqData    // Pasamos los datos de la RFQ para la ruta de Drive
        });

        // --- 4. Actualizar status del RFQ (si ya se completó) ---
        const checkCompletion = await pool.query(
            `SELECT COUNT(*) FROM requisiciones_detalle rd
             LEFT JOIN ordenes_compra_detalle ocd ON rd.id = ocd.requisicion_detalle_id
             WHERE rd.requisicion_id = $1 AND ocd.id IS NULL AND rd.status_compra = 'PENDIENTE'`, [rfqId]
        );
        
        if (checkCompletion.rows[0].count === '0') {
            await pool.query(`UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`, [rfqId]);
        }
        
        res.status(200).json({
            mensaje: `Proceso completado. OC Generada: ${nuevaOc.numero_oc}.`,
            ocs: [nuevaOc] // Mantenemos el formato de array
        });

    } catch (error) {
        console.error(`Error al generar OCs para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
    // (No hay 'finally client.release()' porque el servicio lo maneja)
};

/* ================================================================================================
 * SECCIÓN 3: Exportación del Módulo
 * ==============================================================================================*/
module.exports = {
    getRfqsPorAprobar,
    rechazarRfq,
    generarOcsDesdeRfq,
};